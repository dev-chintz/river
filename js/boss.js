'use strict';
// Boss: poduszkowa forteca "Lewiatan".
(function (G) {
  const W = G.W, H = G.H, TAU = Math.PI * 2;

  class Boss {
    constructor(g, level) {
      this.g = g;
      this.level = level || 1;
      const hpK = 1 + (this.level - 1) * 0.35;
      this.x = W / 2;
      this.ssy = -170;
      this.state = 'enter';
      this.t = 0;
      this.dead = false;
      this.name = 'LEWIATAN';
      this.turrets = [-1, 1].map((s) => ({ s, ox: s * 100, oy: 10, hp: 110 * hpK, max: 110 * hpK, ang: Math.PI, fireT: 1.5 + (s > 0 ? 0.8 : 0), burst: 0, burstT: 0, alive: true, flash: 0 }));
      this.core = { ox: 0, oy: -10, hp: 380 * hpK, max: 380 * hpK, fireT: 2, spin: 0, flash: 0 };
      this.droneT = 6;
      this.deathT = 0;
      this.sprayT = 0;
      this.smokeT = 0;
      this.maxTotal = this.turrets[0].max * 2 + this.core.max;
    }
    get y() {
      return this.g.camY + H - this.ssy;
    }
    get sy() {
      return this.ssy;
    }
    hpFrac() {
      let hp = this.core.hp;
      for (const t of this.turrets) hp += Math.max(0, t.hp);
      return G.clamp(hp / this.maxTotal, 0, 1);
    }
    partWorld(p) {
      return [this.x + p.ox, this.y - p.oy];
    }
    shielded() {
      return this.turrets.some((t) => t.alive);
    }
    targets() {
      const out = [];
      for (const t of this.turrets) if (t.alive) out.push(this.partWorld(t));
      if (!this.shielded() && this.state === 'fight') out.push(this.partWorld(this.core));
      return out;
    }
    // Zwraca true, jeśli pocisk został pochłonięty.
    hitAt(x, y, dmg) {
      if (this.state !== 'fight' && this.state !== 'enter') return false;
      const g = this.g;
      for (const t of this.turrets) {
        if (!t.alive) continue;
        const [tx, ty] = this.partWorld(t);
        if (G.dist2(x, y, tx, ty) < 26 * 26) {
          t.hp -= dmg;
          t.flash = 0.07;
          G.audio.hit(x);
          if (t.hp <= 0) {
            t.alive = false;
            g.fx.explosion(tx, ty, 2);
            G.audio.explosion(true, tx);
            g.addScore(1500, tx, ty);
            g.fx.popup(tx, ty + 30, 'WIEŻA ZNISZCZONA', '#ffd36a', 15);
            if (!this.shielded()) {
              g.message('OSŁONA RDZENIA PADŁA!', '#ff6a5a');
              g.fx.doFlash(0.3, '120,200,255');
            }
          }
          return true;
        }
      }
      const [cx, cy] = this.partWorld(this.core);
      if (G.dist2(x, y, cx, cy) < 40 * 40) {
        if (this.shielded()) {
          g.fx.spark(x, y, 4, '#8fe8ff', 200);
          G.audio.shield();
        } else {
          this.core.hp -= dmg;
          this.core.flash = 0.07;
          G.audio.hit(x);
          if (this.core.hp <= 0) this.startDeath();
        }
        return true;
      }
      return false;
    }
    startDeath() {
      if (this.state === 'dying') return;
      this.state = 'dying';
      this.deathT = 0;
      this.g.eBullets.length = 0;
    }
    update(dt) {
      const g = this.g, p = g.player;
      this.t += dt;
      for (const t of this.turrets) t.flash = Math.max(0, t.flash - dt);
      this.core.flash = Math.max(0, this.core.flash - dt);
      const tx = W / 2 + Math.sin(this.t * 0.45) * 115;
      this.x = G.lerp(this.x, tx, Math.min(1, dt * (this.state === 'enter' ? 0.5 : 2)));

      // piana wokół fartucha
      this.sprayT -= dt;
      if (this.sprayT <= 0 && this.state !== 'escape') {
        this.sprayT = 0.03;
        const a = Math.random() * TAU;
        const ex = this.x + Math.cos(a) * 160, ey = this.y + Math.sin(a) * 100;
        g.fx.add({ kind: 'smoke', img: G.S.foam, x: ex, y: ey, vx: Math.cos(a) * 60, vy: Math.sin(a) * 40 + g.speed * 0.9, life: 1.1, s0: 14, s1: 40, a: 0.6, drag: 0.6 }, 'water');
      }
      // dym z uszkodzeń
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.08;
        for (const t of this.turrets) {
          if (!t.alive) {
            const [wx, wy] = this.partWorld(t);
            g.fx.smokePuff(wx + G.rand(-8, 8), wy, 16, true);
            if (Math.random() < 0.3) g.fx.add({ kind: 'glow', img: G.glow('#ff8a2a'), x: wx, y: wy, vx: 0, vy: 20, life: 0.3, s0: 20, s1: 34 });
          }
        }
      }

      if (this.state === 'enter') {
        this.ssy += (230 - this.ssy) * Math.min(1, dt * 0.9);
        if (this.ssy > 222) {
          this.state = 'fight';
          g.message('UWAGA: LEWIATAN', '#ff5a4a');
        }
        return;
      }
      if (this.state === 'escape') {
        this.ssy -= 150 * dt;
        if (this.ssy < -220) this.dead = true;
        return;
      }
      if (this.state === 'dying') {
        this.deathT += dt;
        if (Math.random() < dt * 14) {
          const ex = this.x + G.rand(-140, 140), ey = this.y + G.rand(-80, 80);
          g.fx.explosion(ex, ey, G.rand(0.8, 1.6), { water: false });
          G.audio.explosion(false, ex);
        }
        this.ssy -= 10 * dt;
        if (this.deathT > 2.8) {
          this.dead = true;
          g.fx.explosion(this.x, this.y, 4.5, { water: true });
          g.fx.doFlash(1, '255,240,210');
          g.fx.shake(24);
          G.audio.explosion(true, this.x);
          g.onBossKilled(this);
        }
        return;
      }

      // ---- walka ----
      const diff = g.difficulty;
      for (const t of this.turrets) {
        if (!t.alive) continue;
        const [wx, wy] = this.partWorld(t);
        const want = Math.atan2(p.x - wx, p.y - wy);
        t.ang += G.angleWrap(want - t.ang) * Math.min(1, dt * 2.5);
        t.fireT -= dt;
        if (t.fireT <= 0 && t.burst === 0 && p.alive) {
          t.burst = 4;
          t.fireT = 2.4 / (1 + diff * 0.04);
        }
        if (t.burst > 0) {
          t.burstT -= dt;
          if (t.burstT <= 0) {
            t.burstT = 0.12;
            t.burst--;
            const mx = wx + Math.sin(t.ang) * 36, my = wy + Math.cos(t.ang) * 36;
            this.fire(mx, my, t.ang, 270, '#ffa23a');
            this.fire(mx, my, t.ang + 0.12, 270, '#ffa23a');
            this.fire(mx, my, t.ang - 0.12, 270, '#ffa23a');
            g.fx.add({ kind: 'glow', img: G.glow('#ffb84a'), x: mx, y: my, vx: 0, vy: 0, life: 0.08, s0: 34, s1: 16 });
            G.audio.enemyShot(mx);
          }
        }
      }
      // rdzeń: spirale pocisków
      const c = this.core;
      const enraged = !this.shielded();
      c.spin += dt * (enraged ? 1.6 : 0.8);
      c.fireT -= dt;
      if (c.fireT <= 0) {
        const [cx, cy] = this.partWorld(c);
        const low = c.hp < c.max * 0.5;
        c.fireT = enraged ? (low ? 0.7 : 1.0) : 2.6;
        const n = enraged ? (low ? 16 : 12) : 8;
        for (let i = 0; i < n; i++) {
          const a = c.spin + (i / n) * TAU;
          if (Math.cos(a) > 0.55) continue; // nie strzela "do tyłu" w górę ekranu
          this.fire(cx, cy, a, enraged ? 190 : 160, '#ff3b8a', 6);
        }
        G.audio.enemyShot(cx);
        if (enraged && low && p.alive) {
          const aim = Math.atan2(p.x - cx, p.y - cy);
          for (let i = -1; i <= 1; i++) this.fire(cx, cy, aim + i * 0.08, 300, '#ffe14a', 5);
        }
      }
      // wypuszczanie dronów
      this.droneT -= dt;
      if (this.droneT <= 0) {
        this.droneT = enraged ? 5 : 7.5;
        for (const s of [-1, 1]) {
          const d = new G.Drone(g, this.x + s * 120, this.y - 60, { kamikaze: true, desc: 120 });
          d.baseX = this.x + s * 160;
          g.enemies.push(d);
        }
      }
      // ucieczka, gdy kończy się arena
      if (this.arenaEnd && g.camY + H > this.arenaEnd - 300) {
        this.state = 'escape';
        g.message('LEWIATAN UCIEKA...', '#ffb86a');
        g.onBossEscaped(this);
      }
    }
    fire(x, y, ang, spd, col, r) {
      this.g.eBullets.push({ x, y, vx: Math.sin(ang) * spd, vy: Math.cos(ang) * spd + this.g.speed, r: r || 5, dmg: 12, col, life: 7 });
    }
    draw(ctx) {
      const sy = this.ssy;
      const x = this.x;
      // fala pod fartuchem
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(G.S.foam, x - 190, sy - 125, 380, 260);
      ctx.restore();
      G.draw(ctx, G.S.boss, x, sy);
      // wentylatory
      ctx.save();
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(x + s * 78, sy - 64);
        ctx.rotate(this.t * 14 * s);
        ctx.fillStyle = 'rgba(160,170,180,0.55)';
        for (let i = 0; i < 5; i++) {
          ctx.rotate(TAU / 5);
          ctx.beginPath();
          ctx.ellipse(0, -12, 4, 11, 0.3, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
      // wieże
      for (const t of this.turrets) {
        const tx = x + t.ox, ty = sy + t.oy;
        if (t.alive) {
          G.draw(ctx, G.S.bossTurret, tx, ty, t.ang);
          if (t.flash > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            G.draw(ctx, G.S.bossTurret, tx, ty, t.ang, 1, 1, 0.9);
            ctx.restore();
          }
        } else {
          ctx.fillStyle = '#0b0c0d';
          ctx.beginPath(); ctx.arc(tx, ty, 22, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,120,40,0.5)';
          ctx.beginPath(); ctx.arc(tx, ty, 8 + Math.random() * 3, 0, TAU); ctx.fill();
        }
      }
      // rdzeń
      const cx = x + this.core.ox, cy = sy + this.core.oy;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.85 + 0.15 * Math.sin(this.t * 6);
      if (this.shielded()) {
        ctx.drawImage(G.glow('#a01030'), cx - 30, cy - 30, 60, 60);
        ctx.globalAlpha = 0.35 + 0.1 * Math.sin(this.t * 3);
        ctx.strokeStyle = '#7fe0ff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, 44, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.18;
        ctx.drawImage(G.glow('#3fb8ff'), cx - 60, cy - 60, 120, 120);
      } else {
        const s = 90 * pulse;
        ctx.drawImage(G.glow('#ff2050'), cx - s / 2, cy - s / 2, s, s);
        ctx.drawImage(G.glow('#ffd0e0'), cx - 14, cy - 14, 28, 28);
        if (this.core.flash > 0) ctx.drawImage(G.glow('#ffffff'), cx - 40, cy - 40, 80, 80);
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(20,24,28,0.9)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const a = this.core.spin + (i / 6) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26);
        ctx.lineTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  G.Boss = Boss;
})(window.G);
