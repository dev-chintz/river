'use strict';
// Rzeka (geometria) i renderer terenu: kafle generowane per-piksel z oświetleniem,
// animowana woda, chmury i ich cienie.
(function (G) {
  const W = G.W, H = G.H;

  // ===================== RZEKA =====================
  class River {
    constructor(seed) {
      this.seed = seed;
      const r = G.rng(seed);
      this.p = [r() * 100, r() * 100, r() * 100];
      this.features = []; // {type:'gate',y} | {type:'arena',y0,y1} | {type:'island',y0,y1,w} | {type:'calm',y0,y1}
    }
    addFeature(f) {
      this.features.push(f);
    }
    prune(minY) {
      this.features = this.features.filter((f) => (f.y1 !== undefined ? f.y1 : f.y) > minY - 1500);
    }
    // Zwraca krawędzie wody na wysokości y: l, r oraz wyspę il, ir (lub il = -1)
    at(y) {
      const s0 = this.seed;
      let hw = 205 + 58 * (G.noise2(y * 0.0008, 3.3, s0) * 2 - 1);
      let s = 0.62 * Math.sin(y * 0.0011 + this.p[0]) + 0.38 * (G.noise2(y * 0.0019, 7.7, s0) * 2 - 1);
      let ih = 0;
      let wob = 1;
      for (let i = 0; i < this.features.length; i++) {
        const f = this.features[i];
        if (f.type === 'gate') {
          const k = 1 - G.smoothstep(260, 700, Math.abs(y - f.y));
          if (k > 0) {
            hw = G.lerp(hw, 172, k);
            s = G.lerp(s, 0, k);
            wob = Math.min(wob, 1 - k * 0.8);
          }
        } else if (f.type === 'arena' || f.type === 'calm') {
          const k = G.smoothstep(f.y0 - 800, f.y0, y) * (1 - G.smoothstep(f.y1, f.y1 + 800, y));
          if (k > 0) {
            hw = G.lerp(hw, f.type === 'arena' ? 262 : 215, k);
            s = G.lerp(s, 0, k * (f.type === 'arena' ? 1 : 0.6));
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
      const c = W / 2 + maxOff * G.clamp(s, -1, 1);
      const wl = (G.noise2(y * 0.011, 11.1, s0) - 0.5) * 22 * wob + (G.noise2(y * 0.04, 12.3, s0) - 0.5) * 6 * wob;
      const wr = (G.noise2(y * 0.011, 21.7, s0) - 0.5) * 22 * wob + (G.noise2(y * 0.04, 22.9, s0) - 0.5) * 6 * wob;
      const out = { l: c - hw + wl, r: c + hw + wr, il: -1, ir: -1, c };
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
        for (let k = k1 + 1; k <= k1 + 5; k++) {
          if (this.chunks.has(k)) continue;
          let it = this.jobs.get(k);
          if (!it) { it = this.genJob(k); this.jobs.set(k, it); }
          let r;
          do { r = it.next(); } while (!r.done && performance.now() - t0 < 4);
          if (r.done) { this.chunks.set(k, r.value); this.jobs.delete(k); }
          if (performance.now() - t0 >= 4) break;
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
      const R = this.river, seed = this.seed;
      const c = G.makeCanvas(W, CH);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(W, CH);
      const d = img.data;
      const rows = CH + 2;
      const hm = new Float32Array(rows * W);
      const info = new Float32Array(rows * W); // >0 ląd (odległość), <=0 woda (-głębokość)
      const lEdge = new Float32Array(rows * W);
      const nArr = new Float32Array(rows * W);
      const fArr = new Float32Array(rows * W);
      const baseY = k * CH + CH; // świat y dla wiersza -1
      for (let ri = 0; ri < rows; ri++) {
        const wy = baseY - ri; // ri=0 -> wiersz -1
        const e = R.at(wy);
        const { l, r, il, ir } = e;
        for (let x = 0; x < W; x++) {
          const idx = ri * W + x;
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
      for (let row = 0; row < CH; row++) {
        const ri = row + 1;
        const wy = baseY - ri;
        for (let x = 0; x < W; x++) {
          const idx = ri * W + x;
          const o = (row * W + x) * 4;
          const inf = info[idx];
          if (inf > 0) {
            const dist = inf;
            const xl = x > 0 ? idx - 1 : idx, xr = x < W - 1 ? idx + 1 : idx;
            const dx = hm[xr] - hm[xl];
            const dy = hm[idx + W] - hm[idx - W];
            let shade = 1 + 4.2 * (dx + dy);
            shade = G.clamp(shade, 0.5, 1.45);
            const n = nArr[idx], f = fArr[idx];
            // kolor bazowy
            let cr, cg, cb;
            // trawa: jasna -> ciemna
            const gt = G.smoothstep(0.32, 0.68, f);
            cr = G.lerp(128, 70, gt); cg = G.lerp(168, 118, gt); cb = G.lerp(72, 44, gt);
            // las
            const ft = G.smoothstep(0.56, 0.66, f);
            cr = G.lerp(cr, 48, ft); cg = G.lerp(cg, 86, ft); cb = G.lerp(cb, 36, ft);
            // łąki z kwiatami / sucha trawa
            const dt = G.smoothstep(0.62, 0.7, 1 - f) * 0.6;
            cr = G.lerp(cr, 176, dt); cg = G.lerp(cg, 170, dt); cb = G.lerp(cb, 92, dt);
            // skały
            const rt = G.smoothstep(0.6, 0.7, n);
            cr = G.lerp(cr, 142, rt); cg = G.lerp(cg, 135, rt); cb = G.lerp(cb, 122, rt);
            // piasek przy brzegu
            const st = 1 - G.smoothstep(9, 20, dist + (n - 0.5) * 14);
            cr = G.lerp(cr, 212, st); cg = G.lerp(cg, 192, st); cb = G.lerp(cb, 140, st);
            const wt = 1 - G.smoothstep(0, 5, dist);
            cr = G.lerp(cr, 150, wt); cg = G.lerp(cg, 132, wt); cb = G.lerp(cb, 92, wt);
            const sp = 1 + (G.hash2(x, wy, seed + 3) - 0.5) * 0.12;
            const m = shade * sp;
            d[o] = G.clamp(cr * m, 0, 255);
            d[o + 1] = G.clamp(cg * m, 0, 255);
            d[o + 2] = G.clamp(cb * m, 0, 255);
            d[o + 3] = 255;
          } else {
            const depth = -inf;
            let r = 0, g = 0, b = 0, a = 0;
            // płycizna
            const sh = Math.pow(1 - G.clamp(depth / 58, 0, 1), 2) * 0.72;
            if (sh > 0) { r = 70; g = 182; b = 172; a = sh; }
            // cień od brzegu (światło z lewej-góry)
            const le = lEdge[idx];
            if (le < 18) {
              const ad = 0.38 * (1 - le / 18);
              const na = ad + a * (1 - ad);
              r = (r * a * (1 - ad)) / na; g = (g * a * (1 - ad)) / na; b = (b * a * (1 - ad)) / na;
              a = na;
            }
            // piana
            const thr = 2 + 3 * fArr[idx];
            if (depth < thr) {
              const af = 0.8 * (1 - depth / thr);
              const na = af + a * (1 - af);
              r = (255 * af + r * a * (1 - af)) / na; g = (255 * af + g * a * (1 - af)) / na; b = (255 * af + b * a * (1 - af)) / na;
              a = na;
            }
            d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a * 255;
          }
        }
        if ((row & 15) === 15) yield;
      }
      ctx.putImageData(img, 0, 0);
      // obiekty: drzewa, skały, domy (także z sąsiednich kafli, by nie ucinać)
      const top = k * CH + CH - 1;
      const objs = [];
      for (let kk = k - 1; kk <= k + 1; kk++) objs.push(...this.objects(kk));
      const S = G.S;
      for (const o of objs) {
        const ry = top - o.y;
        if (ry < -40 || ry > CH + 40) continue;
        const sh = o.kind === 'tree' ? S.treeShadows[o.v] : o.kind === 'pine' ? S.pineShadows[o.v] : o.kind === 'house' ? S.houseShadow : null;
        if (sh) G.draw(ctx, sh, o.x + o.s * 0.45, ry + o.s * 0.55, o.rot, o.s / 20, o.s / 20, 0.32);
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
        if (dist < 16) {
          if (dist > 8 && rr < 0.04) out.push({ kind: 'rock', x, y, v: Math.floor(rv * 4), s: 10 + rs * 8, rot });
          continue;
        }
        if (n > 0.64) {
          if (rr < 0.18) out.push({ kind: 'rock', x, y, v: Math.floor(rv * 4), s: 12 + rs * 14, rot });
          continue;
        }
        let p = f > 0.6 ? 0.95 : f > 0.5 ? 0.35 : 0.05;
        if (rr < p) {
          const pine = f > 0.58 ? rv < 0.45 : rv < 0.12;
          out.push({ kind: pine ? 'pine' : 'tree', x, y, v: pine ? Math.floor(rs * 4) : Math.floor(rs * 8), s: (f > 0.58 ? 16 : 12) + rs * 10, rot });
        } else if (f < 0.36 && dist > 45 && rr > 0.985) {
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
      const cy = Math.round(camY);
      // woda: głęboki kolor + dwie animowane warstwy fal
      ctx.fillStyle = '#0d4a66';
      ctx.fillRect(-40, -40, W + 80, H + 80);
      if (!this.patterns) {
        this.patterns = [ctx.createPattern(this.waterDark, 'repeat'), ctx.createPattern(this.waterLight, 'repeat')];
      }
      const t = this.t;
      ctx.save();
      ctx.globalAlpha = 0.7;
      const ty1 = ((cy + t * 22) % 256) - 256;
      ctx.translate(Math.sin(t * 0.35) * 18 - 40, ty1);
      ctx.fillStyle = this.patterns[0];
      ctx.fillRect(0, 0, W + 120, H + 300);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.55;
      const ty2 = ((cy * 1.0 + t * 46) % 256) - 256;
      ctx.translate(Math.cos(t * 0.27) * 24 - 60, ty2);
      ctx.fillStyle = this.patterns[1];
      ctx.fillRect(0, 0, W + 120, H + 300);
      ctx.restore();
      // błyski
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this.glints) {
        const sy = H - (g.y - cy);
        const a = Math.sin((g.life / g.max) * Math.PI);
        G.draw(ctx, G.S.star, g.x, sy, 0, g.s * a, g.s * a, a * 0.85);
      }
      ctx.restore();
      // kafle terenu
      for (const [k, c] of this.chunks) {
        const sy = H - k * CH - CH + cy;
        if (sy > H + 2 || sy + CH < -2) continue;
        ctx.drawImage(c, 0, sy);
      }
      // cienie chmur
      for (const s of this.shadows) {
        const spr = G.S.cloudShadows[s.k];
        G.draw(ctx, spr, s.x, s.sy, s.rot, s.s, s.s, s.a);
      }
    }

    drawClouds(ctx) {
      for (const c of this.clouds) {
        G.draw(ctx, G.S.clouds[c.k], c.x, c.sy, c.rot, c.s, c.s, c.a);
      }
    }
  }
  G.Terrain = Terrain;
  G.CHUNK = CH;

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
