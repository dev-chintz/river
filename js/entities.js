'use strict';
// Gracz, pociski, przeciwnicy, znajdźki, pierścienie energii, bramy.
(function (G) {
  const W = G.W, H = G.H;
  const TAU = Math.PI * 2;
  const SY = (g, y) => H - (y - g.camY);

  // ===================== GRACZ =====================
  class Player {
    constructor(g) {
      this.g = g;
      this.x = W / 2;
      this.y = g.camY + 190;
      this.vx = 0;
      this.bank = 0;
      this.hull = 100;
      this.energy = 100;
      this.wlevel = 1;
      this.missiles = 3;
      this.fireT = 0;
      this.inv = 2.5;
      this.alive = true;
      this.deadT = 0;
      this.hurtT = 0;
      this.scrapeT = 0;
      this.trailT = 0;
      this.t = 0;
    }

    update(dt) {
      const g = this.g, I = G.Input;
      this.t += dt;
      if (!this.alive) {
        this.deadT -= dt;
        this.y = g.camY + 190;
        if (this.deadT <= 0) g.respawn();
        return;
      }
      let target = I.axisX() * 390;
      if (I.touch.active) target = G.clamp((I.touch.x - this.x) * 7, -440, 440);
      this.vx += (target - this.vx) * Math.min(1, dt * 9);
      this.x = G.clamp(this.x + this.vx * dt, 18, W - 18);
      this.bank += (this.vx / 390 - this.bank) * Math.min(1, dt * 7);
      this.y = g.camY + 190 + g.throttleOffset;
      this.inv = Math.max(0, this.inv - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);

      // kolizja z lądem
      const R = g.river;
      let onLand = 0;
      const pts = [[0, 26], [-24, -2], [24, -2], [0, -26]];
      for (const [dx, dy] of pts) if (!R.isWater(this.x + dx, this.y + dy)) onLand++;
      if (onLand) {
        const sp = R.spanAt(this.x, this.y);
        const mid = (sp[0] + sp[1]) / 2;
        const dir = Math.sign(mid - this.x) || 1;
        this.x += dir * 160 * dt;
        this.vx = this.vx * 0.6 + dir * 60;
        if (this.inv <= 0) this.damage(85 * dt * onLand * 0.5, true);
        this.scrapeT -= dt;
        if (this.scrapeT <= 0) {
          this.scrapeT = 0.05;
          g.fx.spark(this.x - dir * 20, this.y, 3, '#ffcf7a', 260);
          g.fx.smokePuff(this.x - dir * 20, this.y - 10, 12, true);
          G.audio.scrape();
          g.fx.shake(3);
        }
      }

      // reaktor
      this.energy -= g.drainRate() * dt;
      if (this.energy <= 0) {
        this.energy = 0;
        this.kill('energy');
        return;
      }

      // ogień
      this.fireT -= dt;
      const firing = I.down('fire') || I.touch.active;
      if (firing && this.fireT <= 0) this.fire();
      if (I.hit('missile') && this.missiles > 0) this.launchMissile();

      // smugi z końcówek skrzydeł przy szybkim locie
      this.trailT -= dt;
      if (this.trailT <= 0 && g.speed > 230) {
        this.trailT = 0.03;
        for (const s of [-1, 1]) {
          g.fx.add({ kind: 'smoke', img: G.S.smokeLight, x: this.x + s * 33 * (1 - Math.abs(this.bank) * 0.25), y: this.y - 16, vx: 0, vy: g.speed * 0.6, life: 0.35, s0: 4, s1: 9, a: 0.35 });
        }
      }
    }

    fire() {
      const g = this.g;
      const lv = this.wlevel;
      this.fireT = [0, 0.12, 0.09, 0.085, 0.075][lv];
      const spd = 1150;
      const add = (ox, ang, big) => {
        g.pBullets.push({ x: this.x + ox, y: this.y + 30, vx: Math.sin(ang) * spd, vy: Math.cos(ang) * spd + g.speed, dmg: big ? 1.5 : 1, life: 1, ang });
      };
      add(-8, 0, lv >= 2);
      add(8, 0, lv >= 2);
      if (lv >= 3) { add(-16, -0.13); add(16, 0.13); }
      if (lv >= 4) { add(-24, -0.26); add(24, 0.26); }
      g.fx.muzzle(this.x - 8, this.y + 34);
      g.fx.muzzle(this.x + 8, this.y + 34);
      G.audio.shoot();
    }

    launchMissile() {
      const g = this.g;
      this.missiles--;
      for (const s of [-1, 1]) {
        g.missiles.push({ x: this.x + s * 18, y: this.y + 4, ang: s * 0.5, spd: 260 + g.speed, life: 3.2, target: null, trailT: 0, side: s });
      }
      G.audio.missile();
    }

    damage(a, terrain) {
      if (this.inv > 0 || !this.alive) return;
      this.hull -= a;
      if (!terrain) {
        this.hurtT = 0.25;
        this.g.fx.shake(7);
        G.audio.hurt();
      }
      if (this.hull <= 0) {
        this.hull = 0;
        this.kill('hull');
      }
    }

    kill(reason) {
      if (!this.alive) return;
      const g = this.g;
      this.alive = false;
      this.deadT = 2.4;
      g.fx.explosion(this.x, this.y, 2.2, { water: g.river.isWater(this.x, this.y) });
      g.fx.doFlash(0.6, '255,210,160');
      G.audio.explosion(true);
      g.onPlayerDeath(reason);
    }

    drawShadow(ctx) {
      if (!this.alive) return;
      const sy = SY(this.g, this.y);
      const sx = 1 - Math.abs(this.bank) * 0.28;
      G.draw(ctx, G.S.playerShadow, this.x + 38, sy + 52, 0, sx * 0.82, 0.82, 0.3);
    }

    draw(ctx) {
      if (!this.alive) return;
      if (this.inv > 0 && Math.floor(this.inv * 14) % 2 === 0) return;
      const g = this.g;
      const sy = SY(g, this.y);
      const sx = 1 - Math.abs(this.bank) * 0.28;
      // płomień silników
      const thr = G.clamp((g.speed - 95) / 205, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) {
        const fl = 0.8 + Math.random() * 0.4;
        const len = (18 + thr * 30) * fl;
        const ex = this.x + s * 3.2 * sx;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(G.glow('#4cc9ff'), ex - 7, sy + 34, 14, len);
        ctx.globalAlpha = 0.8;
        ctx.drawImage(G.glow('#ffffff'), ex - 3, sy + 34, 6, len * 0.5);
      }
      ctx.globalAlpha = 0.35 + thr * 0.3;
      ctx.drawImage(G.glow('#3aa8ff'), this.x - 22, sy + 22, 44, 44);
      ctx.restore();
      G.draw(ctx, G.S.player, this.x, sy, this.bank * 0.06, sx, 1);
      // światła pozycyjne
      const blink = Math.floor(this.t * 2.5) % 2 === 0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (blink) {
        ctx.drawImage(G.glow('#ff3030'), this.x - 34 * sx - 6, sy + 12, 12, 12);
        ctx.drawImage(G.glow('#30ff60'), this.x + 34 * sx - 6, sy + 12, 12, 12);
      }
      if (this.hurtT > 0) {
        ctx.globalAlpha = this.hurtT * 3;
        G.draw(ctx, G.S.player, this.x, sy, this.bank * 0.06, sx, 1);
      }
      ctx.restore();
      // tarcza po odrodzeniu
      if (this.inv > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 12);
        ctx.strokeStyle = '#6fe8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, sy, 46, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  G.Player = Player;

  // ===================== PRZECIWNICY =====================
  class Enemy {
    constructor(g, x, y) {
      this.g = g;
      this.x = x;
      this.y = y;
      this.hp = 1;
      this.r = 16;
      this.dead = false;
      this.score = 100;
      this.air = false;
      this.water = false;
      this.ground = false;
      this.flash = 0;
      this.t = 0;
      this.drop = 0.08;
      this.expl = 1;
    }
    get sy() {
      return SY(this.g, this.y);
    }
    onScreen(m) {
      const s = this.sy;
      return s > -(m || 0) && s < H + (m || 0);
    }
    hit(dmg) {
      if (this.dead) return;
      this.hp -= dmg;
      this.flash = 0.07;
      if (this.hp <= 0) this.die();
      else G.audio.hit();
    }
    die(silent) {
      if (this.dead) return;
      this.dead = true;
      const g = this.g;
      g.fx.explosion(this.x, this.y, this.expl, { water: this.water, ground: this.ground });
      G.audio.explosion(this.expl > 1.4);
      if (!silent) g.onKill(this);
    }
    baseUpdate(dt) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      if (this.sy > H + 140) this.gone = true;
    }
    drawFlash(ctx, spr, x, y, rot, sx, sy) {
      if (this.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        G.draw(ctx, spr, x, y, rot, sx, sy, 0.9);
        ctx.restore();
      }
    }
    shoot(ang, speed, opts) {
      const g = this.g;
      opts = opts || {};
      g.eBullets.push({ x: opts.x !== undefined ? opts.x : this.x, y: opts.y !== undefined ? opts.y : this.y, vx: Math.sin(ang) * speed, vy: Math.cos(ang) * speed + (opts.inherit ? g.speed : 0), r: opts.r || 5, dmg: opts.dmg || 12, col: opts.col || '#ff5a3a', life: 6 });
    }
    aimAt() {
      const p = this.g.player;
      return Math.atan2(p.x - this.x, p.y - this.y);
    }
  }
  G.Enemy = Enemy;

  // ----- Łódź patrolowa -----
  class Boat extends Enemy {
    constructor(g, x, y) {
      super(g, x, y);
      this.kind = 'boat';
      this.water = true;
      this.hp = 3;
      this.r = 18;
      this.score = 100;
      this.spd = G.rand(50, 95);
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.vx = this.dir * this.spd;
      this.vy = -G.rand(15, 35);
      this.fireT = G.rand(1.2, 3);
      this.wakeT = 0;
      this.heading = Math.atan2(this.vx, this.vy);
    }
    update(dt) {
      this.baseUpdate(dt);
      const g = this.g;
      const sp = g.river.spanAt(this.x, this.y);
      if (this.x < sp[0] + 30) this.dir = 1;
      if (this.x > sp[1] - 30) this.dir = -1;
      this.vx += (this.dir * this.spd - this.vx) * Math.min(1, dt * 1.4);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const th = Math.atan2(this.vx, this.vy);
      this.heading += G.angleWrap(th - this.heading) * Math.min(1, dt * 4);
      this.wakeT -= dt;
      if (this.wakeT <= 0) {
        this.wakeT = 0.05;
        const bx = this.x - Math.sin(this.heading) * 26, by = this.y - Math.cos(this.heading) * 26;
        const px = Math.cos(this.heading), py = -Math.sin(this.heading);
        for (const s of [-1, 1]) {
          g.fx.add({ kind: 'smoke', img: G.S.foam, x: bx + px * s * 6, y: by + py * s * 6, vx: px * s * 22 + G.rand(-4, 4), vy: py * s * 22, life: 1.5, s0: 6, s1: 18, a: 0.55, drag: 0.5 }, 'water');
        }
      }
      if (g.difficulty >= 2 && this.onScreen(-60)) {
        this.fireT -= dt;
        if (this.fireT <= 0 && this.sy < g.player.sy - 120) {
          this.fireT = G.rand(2.2, 3.6) / (1 + g.difficulty * 0.06);
          this.shoot(this.aimAt(), 230 + g.difficulty * 8);
          G.audio.enemyShot();
        }
      }
    }
    draw(ctx) {
      const sy = this.sy;
      const rot = Math.PI - this.heading; // sprite: dziób w górę
      const r = -this.heading + Math.PI;
      void rot;
      // fala dziobowa
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.translate(this.x, sy);
      ctx.rotate(this.screenRot());
      ctx.drawImage(G.S.foam, -18, -40, 36, 22);
      ctx.restore();
      G.draw(ctx, G.S.boat, this.x, sy, this.screenRot());
      this.drawFlash(ctx, G.S.boat, this.x, sy, this.screenRot());
      void r;
    }
    screenRot() {
      // kierunek świata (sin h, cos h) -> ekran (sin h, -cos h); sprite wskazuje w górę ekranu
      return this.heading;
    }
  }
  G.Boat = Boat;

  // ----- Dron -----
  class Drone extends Enemy {
    constructor(g, x, y, opts) {
      super(g, x, y);
      opts = opts || {};
      this.kind = 'drone';
      this.air = true;
      this.hp = 2;
      this.r = 17;
      this.score = 150;
      this.baseX = x;
      this.ph = Math.random() * TAU;
      this.amp = opts.straight ? 0 : G.rand(40, 110);
      this.desc = opts.desc || G.rand(90, 140);
      this.kamikaze = opts.kamikaze !== undefined ? opts.kamikaze : g.difficulty >= 3 && Math.random() < 0.35;
      this.shooter = g.difficulty >= 4 && Math.random() < 0.4;
      this.fireT = G.rand(0.8, 2);
      this.rot = 0;
      this.vx = 0;
      this.diving = false;
    }
    update(dt) {
      this.baseUpdate(dt);
      const g = this.g, p = g.player;
      this.y += (g.speed - this.desc) * dt;
      if (this.kamikaze && !this.diving && p.alive && this.sy > 120 && Math.abs(this.sy - p.sy) < 420) {
        this.diving = true;
        this.desc *= 1.9;
      }
      if (this.diving) {
        const tx = p.x - this.x;
        this.vx += G.clamp(tx * 3, -500, 500) * dt;
        this.vx = G.clamp(this.vx, -260, 260);
        this.x += this.vx * dt;
      } else {
        this.x = this.baseX + Math.sin(this.t * 1.8 + this.ph) * this.amp;
      }
      this.x = G.clamp(this.x, 16, W - 16);
      this.rot = this.diving ? Math.atan2(this.vx, 300) * -0.6 : Math.sin(this.t * 1.8 + this.ph) * 0.25;
      if (this.shooter && this.onScreen(-40) && this.sy < p.sy - 150) {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = G.rand(1.6, 2.6);
          this.shoot(Math.PI, 260, { col: '#ff3b6b' });
          G.audio.enemyShot();
        }
      }
    }
    drawShadow(ctx) {
      G.draw(ctx, G.S.droneShadow, this.x + 26, this.sy + 38, this.rot, 0.8, 0.8, 0.28);
    }
    draw(ctx) {
      const sy = this.sy;
      G.draw(ctx, G.S.drone, this.x, sy, this.rot);
      this.drawFlash(ctx, G.S.drone, this.x, sy, this.rot);
      // wirniki
      ctx.save();
      ctx.translate(this.x, sy);
      ctx.rotate(this.rot);
      for (const [a, b] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
        ctx.fillStyle = 'rgba(200,215,230,0.16)';
        ctx.beginPath(); ctx.arc(a, b, 10, 0, TAU); ctx.fill();
        const ang = this.t * 40 + a;
        ctx.strokeStyle = 'rgba(30,35,40,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a + Math.cos(ang) * 10, b + Math.sin(ang) * 10);
        ctx.lineTo(a - Math.cos(ang) * 10, b - Math.sin(ang) * 10);
        ctx.stroke();
      }
      ctx.restore();
      // oko
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.7 + 0.3 * Math.sin(this.t * 10);
      const s = (this.diving ? 30 : 22) * pulse;
      ctx.drawImage(G.glow('#ff2a4a'), this.x - s / 2, sy + 2 - s / 2, s, s);
      ctx.restore();
    }
  }
  G.Drone = Drone;

  // ----- Wieżyczka na brzegu -----
  class Turret extends Enemy {
    constructor(g, x, y) {
      super(g, x, y);
      this.kind = 'turret';
      this.ground = true;
      this.hp = 5;
      this.r = 24;
      this.score = 200;
      this.drop = 0.14;
      this.ang = Math.PI;
      this.fireT = G.rand(1, 2.5);
      this.burst = 0;
      this.burstT = 0;
    }
    update(dt) {
      this.baseUpdate(dt);
      const g = this.g, p = g.player;
      const want = this.aimAt();
      this.ang += G.angleWrap(want - this.ang) * Math.min(1, dt * 3);
      if (!this.onScreen(-30) || !p.alive) return;
      if (this.sy > p.sy - 60) return;
      this.fireT -= dt;
      if (this.fireT <= 0 && this.burst === 0) {
        this.burst = 2 + Math.min(3, Math.floor(g.difficulty / 2));
        this.burstT = 0;
        this.fireT = G.rand(2.2, 3.2) / (1 + g.difficulty * 0.05);
      }
      if (this.burst > 0) {
        this.burstT -= dt;
        if (this.burstT <= 0) {
          this.burstT = 0.14;
          this.burst--;
          const mx = this.x + Math.sin(this.ang) * 22, my = this.y + Math.cos(this.ang) * 22;
          this.shoot(this.ang, 250 + g.difficulty * 10, { x: mx, y: my, col: '#ffa23a' });
          g.fx.add({ kind: 'glow', img: G.glow('#ffb84a'), x: mx, y: my, vx: 0, vy: 0, life: 0.08, s0: 26, s1: 14 });
          G.audio.enemyShot();
        }
      }
    }
    draw(ctx) {
      const sy = this.sy;
      G.draw(ctx, G.S.turretBase, this.x, sy);
      const rot = this.ang;
      G.draw(ctx, G.S.turretHead, this.x, sy, rot);
      this.drawFlash(ctx, G.S.turretHead, this.x, sy, rot);
    }
  }
  G.Turret = Turret;

  // ----- Mina zbliżeniowa -----
  class Mine extends Enemy {
    constructor(g, x, y) {
      super(g, x, y);
      this.kind = 'mine';
      this.water = true;
      this.hp = 1;
      this.r = 15;
      this.score = 60;
      this.drop = 0.03;
      this.armed = 0;
      this.vy = -G.rand(10, 22);
    }
    update(dt) {
      this.baseUpdate(dt);
      const g = this.g, p = g.player;
      this.y += this.vy * dt;
      if (!this.armed && p.alive && G.dist2(this.x, this.y, p.x, p.y) < 85 * 85) {
        this.armed = 0.5;
      }
      if (this.armed) {
        this.armed -= dt;
        if (this.armed <= 0) {
          if (p.alive && G.dist2(this.x, this.y, p.x, p.y) < 95 * 95) p.damage(32);
          this.expl = 1.5;
          this.die(true);
        }
      }
    }
    draw(ctx) {
      const sy = this.sy;
      const bob = Math.sin(this.t * 3) * 0.06;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#d8f4ff';
      ctx.lineWidth = 1.2;
      const rr = 18 + (this.t * 14) % 14;
      ctx.beginPath(); ctx.ellipse(this.x, sy, rr, rr * 0.85, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      G.draw(ctx, G.S.mine, this.x, sy, this.t * 0.4, 1 + bob, 1 + bob);
      this.drawFlash(ctx, G.S.mine, this.x, sy, this.t * 0.4);
      const fast = this.armed ? 18 : 3;
      if (Math.floor(this.t * fast) % 2 === 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const s = this.armed ? 44 : 18;
        ctx.drawImage(G.glow('#ff2020'), this.x - s / 2, sy - s / 2, s, s);
        ctx.restore();
      }
    }
  }
  G.Mine = Mine;

  // ----- Śmigłowiec szturmowy -----
  class Gunship extends Enemy {
    constructor(g, x) {
      super(g, x, g.camY + H + 80);
      this.kind = 'gunship';
      this.air = true;
      this.hp = 14 + g.difficulty * 1.5;
      this.r = 30;
      this.score = 600;
      this.drop = 0.5;
      this.expl = 1.7;
      this.ssy = -80;
      this.state = 'in';
      this.holdT = 7;
      this.fireT = 1.4;
      this.baseX = x;
      this.rot = 0;
    }
    update(dt) {
      this.baseUpdate(dt);
      const g = this.g;
      if (this.state === 'in') {
        this.ssy += (250 - this.ssy) * Math.min(1, dt * 1.3);
        if (this.ssy > 235) this.state = 'hold';
      } else if (this.state === 'hold') {
        this.holdT -= dt;
        if (this.holdT <= 0) this.state = 'out';
        this.fireT -= dt;
        if (this.fireT <= 0 && g.player.alive) {
          this.fireT = G.rand(1.4, 2) / (1 + g.difficulty * 0.04);
          const a = this.aimAt();
          const n = g.difficulty >= 5 ? 7 : 5;
          for (let i = 0; i < n; i++) this.shoot(a + (i - (n - 1) / 2) * 0.16, 240, { y: this.y - 30, col: '#ff7a2a', r: 6 });
          G.audio.enemyShot();
        }
      } else {
        this.ssy -= 160 * dt;
        if (this.ssy < -150) this.gone = true;
      }
      const tx = this.baseX + Math.sin(this.t * 0.7) * 150;
      const nx = G.clamp(G.lerp(this.x, tx, Math.min(1, dt * 1.5)), 50, W - 50);
      this.rot = G.clamp((nx - this.x) * 0.04, -0.3, 0.3);
      this.x = nx;
      this.y = g.camY + H - this.ssy;
    }
    drawShadow(ctx) {
      G.draw(ctx, G.S.gunshipShadow, this.x + 44, this.sy + 70, Math.PI + this.rot, 0.75, 0.75, 0.25);
    }
    draw(ctx) {
      const sy = this.sy;
      const rot = Math.PI + this.rot;
      G.draw(ctx, G.S.gunship, this.x, sy, rot);
      this.drawFlash(ctx, G.S.gunship, this.x, sy, rot);
      // wirnik główny
      ctx.save();
      ctx.translate(this.x, sy + 2);
      ctx.fillStyle = 'rgba(210,220,230,0.1)';
      ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(25,30,25,0.55)';
      ctx.lineWidth = 3;
      const a0 = this.t * 26;
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i * Math.PI) / 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); ctx.stroke();
      }
      ctx.restore();
      // śmigło ogonowe
      ctx.save();
      ctx.translate(this.x - Math.sin(rot) * 0, sy - 42);
      ctx.fillStyle = 'rgba(210,220,230,0.18)';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
      ctx.restore();
      // światła
      if (Math.floor(this.t * 3) % 2 === 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(G.glow('#ff3030'), this.x - 34, sy - 6, 14, 14);
        ctx.drawImage(G.glow('#ff3030'), this.x + 20, sy - 6, 14, 14);
        ctx.restore();
      }
    }
  }
  G.Gunship = Gunship;

  // ----- Generator pola siłowego (część bramy) -----
  class Pylon extends Enemy {
    constructor(g, x, y, gate) {
      super(g, x, y);
      this.kind = 'pylon';
      this.water = true;
      this.hp = 12 + g.difficulty * 1.5;
      this.r = 24;
      this.score = 400;
      this.drop = 0.25;
      this.expl = 1.8;
      this.gate = gate;
    }
    update(dt) {
      this.baseUpdate(dt);
    }
    die(silent) {
      super.die(silent);
      this.gate.onPylonDown();
    }
    draw(ctx) {
      const sy = this.sy;
      G.draw(ctx, G.S.pylon, this.x, sy);
      this.drawFlash(ctx, G.S.pylon, this.x, sy);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const p = 0.75 + 0.25 * Math.sin(this.t * 8);
      ctx.drawImage(G.glow('#7a5cff'), this.x - 30 * p, sy - 30 * p, 60 * p, 60 * p);
      ctx.drawImage(G.glow('#5ff2ff'), this.x - 12, sy - 12, 24, 24);
      ctx.restore();
    }
  }
  G.Pylon = Pylon;

  // ===================== BRAMA =====================
  class Gate {
    constructor(g, y) {
      this.g = g;
      this.y = y;
      const e = g.river.at(y);
      // platformy generatorów stoją na wodzie przy samych brzegach
      this.bl = e.l;
      this.br = e.r;
      this.lx = e.l + 40;
      this.rx = e.r - 40;
      this.left = new Pylon(g, this.lx, y, this);
      this.right = new Pylon(g, this.rx, y, this);
      g.enemies.push(this.left, this.right);
      this.active = true;
      this.passed = false;
      this.t = 0;
      this.bolts = [];
    }
    onPylonDown() {
      if (this.left.dead && this.right.dead && this.active) {
        this.active = false;
        this.g.onGateDown(this);
      }
    }
    update(dt) {
      this.t += dt;
    }
    draw(ctx) {
      if (!this.active) return;
      const g = this.g;
      const sy = SY(g, this.y);
      if (sy < -60 || sy > H + 60) return;
      const x0 = this.bl - 6, x1 = this.br + 6;
      const weak = this.left.dead || this.right.dead;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // pas energii
      const flick = weak ? (Math.random() < 0.3 ? 0.3 : 0.8) : 1;
      ctx.globalAlpha = 0.5 * flick;
      ctx.drawImage(G.glow('#6a4cff'), x0, sy - 26, x1 - x0, 52);
      ctx.globalAlpha = 0.6 * flick;
      ctx.drawImage(G.glow('#4fe8ff'), x0, sy - 9, x1 - x0, 18);
      // błyskawice
      ctx.globalAlpha = flick;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = k === 0 ? '#ffffff' : k === 1 ? '#8ff6ff' : '#b49cff';
        ctx.lineWidth = k === 0 ? 1.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(x0, sy);
        const n = 18;
        for (let i = 1; i <= n; i++) {
          const px = x0 + ((x1 - x0) * i) / n;
          const py = i === n ? sy : sy + (Math.random() - 0.5) * (k === 0 ? 10 : 22);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  G.Gate = Gate;

  // ===================== ZNAJDŹKI I PIERŚCIENIE =====================
  class Pickup {
    constructor(g, x, y, type) {
      this.g = g;
      this.x = x;
      this.y = y;
      this.type = type;
      this.t = Math.random() * 5;
      this.dead = false;
    }
    update(dt) {
      this.t += dt;
      const g = this.g, p = g.player;
      // lekkie przyciąganie
      if (p.alive) {
        const d2 = G.dist2(this.x, this.y, p.x, p.y);
        if (d2 < 120 * 120) {
          const d = Math.sqrt(d2) || 1;
          this.x += ((p.x - this.x) / d) * 180 * dt;
          this.y += ((p.y - this.y) / d) * 180 * dt;
        }
        if (d2 < 34 * 34) {
          this.dead = true;
          g.onPickup(this);
        }
      }
      if (SY(g, this.y) > H + 60) this.dead = true;
    }
    draw(ctx) {
      const sy = SY(this.g, this.y) + Math.sin(this.t * 3) * 3;
      const col = this.type === 'W' ? '#ffae3c' : this.type === 'M' ? '#c77dff' : '#5cff8a';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const p = 0.8 + 0.2 * Math.sin(this.t * 6);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(G.glow(col), this.x - 34 * p, sy - 34 * p, 68 * p, 68 * p);
      ctx.restore();
      const spr = this.type === 'W' ? G.S.pickW : this.type === 'M' ? G.S.pickM : G.S.pickR;
      G.draw(ctx, spr, this.x, sy, Math.sin(this.t * 2) * 0.2);
    }
  }
  G.Pickup = Pickup;

  class Ring {
    constructor(g, x, y) {
      this.g = g;
      this.x = x;
      this.y = y;
      this.t = Math.random() * 5;
      this.dead = false;
    }
    update(dt) {
      this.t += dt;
      const g = this.g, p = g.player;
      if (p.alive && Math.abs(p.x - this.x) < 34 && Math.abs(p.y - this.y) < 26) {
        this.dead = true;
        g.onRing(this);
      }
      if (SY(g, this.y) > H + 60) this.dead = true;
    }
    drawShadow(ctx) {
      const sy = SY(this.g, this.y);
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#001018';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(this.x + 20, sy + 30, 30, 15, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    draw(ctx) {
      const sy = SY(this.g, this.y);
      const t = this.t;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 4);
      ctx.drawImage(G.glow('#22d8ff'), this.x - 60, sy - 40, 120, 80);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#33e4ff';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(this.x, sy, 32, 16, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#e6fdff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, sy, 32, 16, 0, 0, TAU); ctx.stroke();
      // obracające się segmenty
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + (i * TAU) / 3;
        ctx.beginPath(); ctx.ellipse(this.x, sy, 38, 20, 0, a, a + 0.6); ctx.stroke();
      }
      // rdzeń
      ctx.globalAlpha = 0.7;
      ctx.drawImage(G.glow('#bff8ff'), this.x - 10, sy - 10, 20, 20);
      ctx.restore();
    }
  }
  G.Ring = Ring;
})(window.G);
