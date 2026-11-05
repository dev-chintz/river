'use strict';
// Cząsteczki, eksplozje, ślady na ziemi, wstrząsy ekranu.
(function (G) {
  const H = G.H;

  class FX {
    constructor(game) {
      this.g = game;
      this.top = [];   // nad obiektami
      this.water = []; // na powierzchni wody (piana, kręgi)
      this.decals = [];
      this.shakeAmt = 0;
      this.flash = 0;
      this.flashCol = '255,255,255';
      this.popups = [];
    }
    add(p, layer) {
      const arr = layer === 'water' ? this.water : this.top;
      p.max = p.life;
      if (p.s1 === undefined) p.s1 = p.s0;
      if (p.drag === undefined) p.drag = 1;
      arr.push(p);
      if (arr.length > 1600) arr.splice(0, 200);
      return p;
    }
    shake(a) {
      this.shakeAmt = Math.min(24, Math.max(this.shakeAmt, a));
    }
    doFlash(a, col) {
      this.flash = Math.max(this.flash, a);
      this.flashCol = col || '255,255,255';
    }
    popup(x, y, text, col, size) {
      this.popups.push({ x, y, text, col: col || '#fff', t: 0, size: size || 16 });
    }

    spark(x, y, n, col, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = G.rand(0.3, 1) * (speed || 300);
        this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: G.rand(0.15, 0.35), s0: 2, col: col || '#ffd27a', drag: 0.02 });
      }
    }

    muzzle(x, y) {
      this.add({ kind: 'glow', img: G.glow('#ffcc55'), x, y, vx: 0, vy: 0, life: 0.06, s0: 22, s1: 12, follow: true });
    }

    smokePuff(x, y, s, dark) {
      this.add({ kind: 'smoke', img: dark ? G.S.smoke : G.S.smokeLight, x: x + G.rand(-3, 3), y: y + G.rand(-3, 3), vx: G.rand(-10, 10), vy: G.rand(-10, 10), life: G.rand(0.5, 1), s0: s, s1: s * 2.6, a: 0.6, rot: Math.random() * 6, vr: G.rand(-1, 1) });
    }

    explosion(x, y, sc, opts) {
      opts = opts || {};
      sc = sc || 1;
      const water = opts.water, ground = opts.ground;
      // błysk
      this.add({ kind: 'glow', img: G.glow('#ffe7a0'), x, y, vx: 0, vy: 0, life: 0.18, s0: 90 * sc, s1: 200 * sc });
      // kule ognia
      const nf = Math.round(9 * sc + 4);
      for (let i = 0; i < nf; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 12 * sc, v = G.rand(20, 130) * sc;
        this.add({
          kind: 'glow', img: G.glow(G.pick(['#ff8a2a', '#ff6a1a', '#ffb347', '#ff9a3c'])),
          x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: G.rand(0.35, 0.75), s0: G.rand(26, 46) * sc, s1: G.rand(60, 100) * sc, drag: 0.15, delay: Math.random() * 0.08,
        });
      }
      for (let i = 0; i < 3; i++) {
        this.add({ kind: 'glow', img: G.glow('#fff3c4'), x: x + G.rand(-6, 6) * sc, y: y + G.rand(-6, 6) * sc, vx: 0, vy: 0, life: 0.22, s0: 40 * sc, s1: 70 * sc });
      }
      // dym
      const ns = Math.round(7 * sc + 3);
      for (let i = 0; i < ns; i++) {
        const a = Math.random() * Math.PI * 2, v = G.rand(10, 60) * sc;
        this.add({
          kind: 'smoke', img: water ? G.S.smokeLight : G.S.smoke, x: x + G.rand(-10, 10) * sc, y: y + G.rand(-10, 10) * sc,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v + 12, life: G.rand(1.0, 2.2), s0: G.rand(20, 34) * sc, s1: G.rand(70, 120) * sc,
          a: water ? 0.45 : 0.62, drag: 0.4, rot: Math.random() * 6, vr: G.rand(-0.6, 0.6), delay: 0.05 + Math.random() * 0.12,
        });
      }
      // iskry
      const nk = Math.round(14 * sc + 6);
      for (let i = 0; i < nk; i++) {
        const a = Math.random() * Math.PI * 2, v = G.rand(180, 520) * Math.sqrt(sc);
        this.add({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: G.rand(0.25, 0.65), s0: G.rand(1.5, 2.8), col: G.pick(['#ffd27a', '#ffefc0', '#ff9a40']), drag: 0.08 });
      }
      // odłamki
      const nd = Math.round(5 * sc + 2);
      for (let i = 0; i < nd; i++) {
        const a = Math.random() * Math.PI * 2, v = G.rand(80, 260) * Math.sqrt(sc);
        this.add({ kind: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: G.rand(0.5, 1.1), s0: G.rand(2, 5) * Math.sqrt(sc), rot: Math.random() * 6, vr: G.rand(-12, 12), drag: 0.25, col: G.pick(['#2a2d31', '#3d4248', '#55504a']) });
      }
      // fala uderzeniowa
      this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.45, s0: 8 * sc, s1: 95 * sc, col: '255,225,170', w: 4 * sc });
      if (water) {
        this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 1.4, s0: 10 * sc, s1: 110 * sc, col: '230,250,255', w: 3 }, 'water');
        this.add({ kind: 'ring', x, y, vx: 0, vy: 0, life: 1.9, s0: 6 * sc, s1: 70 * sc, col: '230,250,255', w: 2, delay: 0.25 }, 'water');
        for (let i = 0; i < 14 * sc; i++) {
          const a = Math.random() * Math.PI * 2, v = G.rand(30, 140) * sc;
          this.add({ kind: 'smoke', img: G.S.foam, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: G.rand(0.6, 1.4), s0: G.rand(8, 16) * sc, s1: G.rand(20, 40) * sc, a: 0.8, drag: 0.6 });
        }
        G.audio.splash(x);
      }
      if (ground) {
        this.decals.push({ x, y, s: G.rand(0.8, 1.2) * sc, rot: Math.random() * 6, a: 0.9 });
      }
      this.shake(5 * sc);
    }

    update(dt) {
      const upd = (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i];
          if (p.delay > 0) { p.delay -= dt; continue; }
          p.life -= dt;
          if (p.life <= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); continue; }
          if (p.drag !== 1) {
            const k = Math.pow(p.drag, dt);
            p.vx *= k;
            p.vy *= k;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.vr) p.rot += p.vr * dt;
        }
      };
      upd(this.top);
      upd(this.water);
      this.shakeAmt *= Math.pow(0.002, dt);
      if (this.shakeAmt < 0.2) this.shakeAmt = 0;
      this.flash = Math.max(0, this.flash - dt * 2.5);
      const camY = this.g.camY;
      this.decals = this.decals.filter((d) => H - (d.y - camY) < H + 80);
      for (const p of this.popups) { p.t += dt; p.y += 40 * dt; }
      this.popups = this.popups.filter((p) => p.t < 1.1);
    }

    drawList(ctx, arr) {
      const camY = this.g.camY;
      let blend = '';
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (p.delay > 0) continue;
        const t = 1 - p.life / p.max; // 0 -> 1
        const sx = p.x, sy = H - (p.y - camY);
        if (sy < -150 || sy > H + 150) continue;
        const s = p.s0 + (p.s1 - p.s0) * t;
        if (p.kind === 'glow') {
          if (blend !== 'lighter') { ctx.globalCompositeOperation = 'lighter'; blend = 'lighter'; }
          ctx.globalAlpha = Math.pow(1 - t, 1.3);
          ctx.drawImage(p.img, sx - s / 2, sy - s / 2, s, s);
        } else if (p.kind === 'smoke') {
          if (blend !== 'source-over') { ctx.globalCompositeOperation = 'source-over'; blend = 'source-over'; }
          ctx.globalAlpha = (p.a || 0.6) * Math.min(1, (1 - t) * 1.6) * Math.min(1, t * 8 + 0.2);
          if (p.rot) {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(p.rot);
            ctx.drawImage(p.img, -s / 2, -s / 2, s, s);
            ctx.restore();
          } else ctx.drawImage(p.img, sx - s / 2, sy - s / 2, s, s);
        } else if (p.kind === 'spark') {
          if (blend !== 'lighter') { ctx.globalCompositeOperation = 'lighter'; blend = 'lighter'; }
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = p.col;
          ctx.lineWidth = p.s0;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - p.vx * 0.03, sy + p.vy * 0.03);
          ctx.stroke();
        } else if (p.kind === 'ring') {
          if (blend !== 'source-over') { ctx.globalCompositeOperation = 'source-over'; blend = 'source-over'; }
          ctx.globalAlpha = Math.pow(1 - t, 1.5) * 0.8;
          ctx.strokeStyle = `rgb(${p.col})`;
          ctx.lineWidth = p.w * (1 - t) + 0.5;
          ctx.beginPath();
          ctx.ellipse(sx, sy, s, s * (p.flat || 0.85), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'debris') {
          if (blend !== 'source-over') { ctx.globalCompositeOperation = 'source-over'; blend = 'source-over'; }
          ctx.globalAlpha = Math.min(1, (1 - t) * 2);
          ctx.fillStyle = p.col;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    drawDecals(ctx) {
      const camY = this.g.camY;
      for (const d of this.decals) {
        G.draw(ctx, G.S.scorch, d.x, H - (d.y - camY), d.rot, d.s, d.s, d.a);
      }
    }
    drawWater(ctx) {
      this.drawList(ctx, this.water);
    }
    drawTop(ctx) {
      this.drawList(ctx, this.top);
    }
    drawPopups(ctx) {
      const camY = this.g.camY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const p of this.popups) {
        const a = p.t < 0.8 ? 1 : 1 - (p.t - 0.8) / 0.3;
        const sc = p.t < 0.12 ? 0.6 + p.t * 3.4 : 1;
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = `700 ${Math.round(p.size * sc)}px ${G.FONT}`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        const sy = H - (p.y - camY);
        ctx.strokeText(p.text, p.x, sy);
        ctx.fillStyle = p.col;
        ctx.fillText(p.text, p.x, sy);
      }
      ctx.globalAlpha = 1;
    }
  }
  G.FX = FX;
})(window.G);
