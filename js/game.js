'use strict';
// Stan rozgrywki: aktualizacja świata, kolizje, punkty, rysowanie sceny.
(function (G) {
  const W = G.W, H = G.H, TAU = Math.PI * 2;
  const SY = (g, y) => H - (y - g.camY);

  class Game {
    constructor(mode, seed) {
      this.mode = mode;
      this.cfg = G.MODES[mode];
      this.seed = seed || ((Math.random() * 1e9) | 0);
      this.camY = 0;
      this.speed = mode === 'attract' ? 120 : 160;
      this.throttleOffset = 0;
      this.level = new G.Level(this, mode, this.seed);
      this.river = this.level.river;
      this.terrain = new G.Terrain(this.river, this.seed);
      this.fx = new G.FX(this);
      this.enemies = [];
      this.pBullets = [];
      this.eBullets = [];
      this.missiles = [];
      this.pickups = [];
      this.rings = [];
      this.gates = [];
      this.player = new G.Player(this);
      this.score = 0;
      this.lives = this.cfg.lives === Infinity ? Infinity : this.cfg.lives;
      this.combo = 0;
      this.comboT = 0;
      this.mult = 1;
      this.time = 0;
      this.timeLeft = this.cfg.time || 0;
      this.sectorIdx = 0;
      this.boss = null;
      this.bossCount = 0;
      this.msgs = [];
      this.banner = null;
      this.finished = false;
      this.done = false;
      this.won = false;
      this.finishT = 0;
      this.gameOverPending = false;
      this.nextLife = 50000;
      this.lowET = 0;
      this.stats = { kills: 0, rings: 0, gates: 0, bosses: 0 };
      this.level.ensure(0);
      this.terrain.ensure(0, 5);
      if (mode !== 'attract') this.showBanner();
    }

    get difficulty() {
      if (this.mode === 'time') return Math.min(12, 1 + this.time / 22);
      return Math.min(14, this.sectorIdx + 1);
    }

    drainRate() {
      const k = Math.pow(this.speed / 160, 0.75);
      return 2.7 * k * (this.boss ? 0.45 : 1);
    }

    showBanner() {
      const s = this.level.sectors[this.sectorIdx];
      let sub;
      if (this.mode === 'campaign') sub = s && s.name ? s.name : '';
      else if (this.mode === 'time') sub = 'Zdobądź jak najwięcej punktów';
      else sub = s && s.boss ? 'Sektor z fortecą wroga' : 'Nieskończona delta';
      this.banner = { title: 'SEKTOR ' + (this.sectorIdx + 1), sub, t: 0, boss: s && s.boss };
    }

    message(text, col) {
      this.msgs.push({ text, col: col || '#ffffff', t: 0 });
      if (this.msgs.length > 3) this.msgs.shift();
    }

    addScore(pts, x, y, noPopup) {
      pts = Math.round(pts);
      this.score += pts;
      if (!noPopup && x !== undefined) this.fx.popup(x, y + 20, '+' + pts, this.mult > 1 ? '#ffd36a' : '#ffffff', this.mult > 1 ? 17 : 15);
      if (this.mode !== 'time' && this.score >= this.nextLife) {
        this.nextLife += 50000;
        this.lives++;
        this.message('DODATKOWA MASZYNA!', '#7dffb0');
        G.audio.extraLife();
      }
    }

    // ---------- zdarzenia ----------
    onKill(e) {
      this.stats.kills++;
      this.combo++;
      this.comboT = 2.4;
      this.mult = Math.min(8, 1 + Math.floor(this.combo / 4));
      this.addScore(e.score * this.mult, e.x, e.y);
      this.player.energy = Math.min(100, this.player.energy + 1.6);
      if (Math.random() < e.drop) {
        const p = this.player;
        let type = G.pick(['W', 'M', 'R', 'W', 'M']);
        if (p.hull < 45 && Math.random() < 0.6) type = 'R';
        if (p.wlevel >= 4 && type === 'W') type = 'M';
        this.pickups.push(new G.Pickup(this, e.x, e.y, type));
      }
    }

    onPickup(p) {
      const pl = this.player;
      G.audio.pickup();
      this.fx.add({ kind: 'ring', x: p.x, y: p.y, vx: 0, vy: 0, life: 0.4, s0: 10, s1: 60, col: '255,255,255', w: 3 });
      if (p.type === 'W') {
        if (pl.wlevel < 4) {
          pl.wlevel++;
          this.message('UZBROJENIE: POZIOM ' + pl.wlevel, '#ffbe5c');
        } else this.addScore(500, p.x, p.y);
      } else if (p.type === 'M') {
        pl.missiles = Math.min(9, pl.missiles + 3);
        this.message('RAKIETY +3', '#d49bff');
      } else {
        pl.hull = Math.min(100, pl.hull + 40);
        this.message('NAPRAWA PANCERZA', '#7dffb0');
      }
    }

    onRing(r) {
      const p = this.player;
      p.energy = Math.min(100, p.energy + 24);
      this.stats.rings++;
      this.addScore(50 * this.mult, r.x, r.y);
      G.audio.ring();
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        this.fx.add({ kind: 'glow', img: G.glow('#3ce8ff'), x: r.x + Math.cos(a) * 30, y: r.y + Math.sin(a) * 15, vx: Math.cos(a) * 120, vy: Math.sin(a) * 60, life: 0.45, s0: 16, s1: 4 });
      }
      this.fx.add({ kind: 'ring', x: r.x, y: r.y, vx: 0, vy: 0, life: 0.5, s0: 30, s1: 90, col: '120,240,255', w: 4, flat: 0.5 });
    }

    onGateDown(gate) {
      this.stats.gates++;
      this.addScore(1000 + 250 * this.sectorIdx, W / 2, gate.y);
      this.message('POLE SIŁOWE WYŁĄCZONE', '#8ff6ff');
      G.audio.gate();
      this.fx.doFlash(0.25, '140,220,255');
    }

    onSectorPassed() {
      this.sectorIdx++;
      if (this.mode === 'campaign' && this.sectorIdx >= this.cfg.sectors) {
        this.message('DELTA WYZWOLONA!', '#7dffb0');
        this.finish(true);
        return;
      }
      if (this.mode === 'time') this.timeLeft += 10;
      this.showBanner();
      if (this.mode === 'time') this.message('+10 SEKUND', '#8ff6ff');
    }

    startBoss(s) {
      this.bossCount++;
      this.boss = new G.Boss(this, this.bossCount);
      this.boss.arenaEnd = s.arenaY1;
      this.message('WYKRYTO DUŻY OBIEKT', '#ff6a5a');
      G.audio.alarm();
    }

    onBossKilled(b) {
      this.stats.bosses++;
      this.addScore(8000 * b.level, b.x, b.y);
      this.message('LEWIATAN ZNISZCZONY!', '#ffd36a');
      this.pickups.push(new G.Pickup(this, b.x - 40, b.y, 'W'));
      this.pickups.push(new G.Pickup(this, b.x + 40, b.y, 'R'));
    }

    onBossEscaped() {}

    onPlayerDeath(reason) {
      const txt = { energy: 'REAKTOR WYCZERPANY', field: 'ZDERZENIE Z POLEM SIŁOWYM', hull: 'MASZYNA ZESTRZELONA' }[reason] || 'MASZYNA ZNISZCZONA';
      this.message(txt, '#ff6a5a');
      this.combo = 0;
      this.mult = 1;
      if (this.mode === 'time') {
        this.timeLeft = Math.max(0, this.timeLeft - 15);
        this.message('-15 SEKUND', '#ff9a5a');
      } else if (this.lives <= 0) this.gameOverPending = true;
      else this.lives--;
    }

    respawn() {
      if (this.gameOverPending) {
        this.finish(false);
        this.player.deadT = 999;
        return;
      }
      const p = this.player;
      const sp = this.river.spans(p.y).sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
      p.x = (sp[0] + sp[1]) / 2;
      p.vx = 0;
      p.bank = 0;
      p.hull = 100;
      p.energy = 100;
      p.inv = 3;
      p.alive = true;
      p.wlevel = Math.max(1, p.wlevel - 1);
      p.missiles = Math.max(p.missiles, 3);
      this.eBullets.length = 0;
      for (const e of this.enemies) {
        if (e.air && !e.dead && e.sy > H * 0.4) e.die(true);
      }
    }

    finish(won) {
      if (this.finished) return;
      this.finished = true;
      this.won = won;
      this.finishT = won ? 3.5 : 2.5;
    }

    // ---------- aktualizacja ----------
    update(dt) {
      if (this.mode === 'attract') {
        this.camY += this.speed * dt;
        this.level.ensure(this.camY);
        this.terrain.ensure(this.camY, 1);
        this.terrain.update(dt, this.camY, this.speed);
        this.fx.update(dt);
        return;
      }
      const I = G.Input, p = this.player;
      this.time += dt;
      this.level.ensure(this.camY);

      // przepustnica
      const thr = I.touch.active ? 0 : I.axisY();
      let target = thr > 0 ? 160 + 140 * thr : thr < 0 ? 160 + 65 * thr : 160;
      if (this.boss && this.boss.state !== 'escape') target = 50;
      if (!p.alive) target = 130;
      if (this.finished && this.won) target = 260;
      this.speed += (target - this.speed) * Math.min(1, dt * 2.2);
      this.throttleOffset += ((this.speed - 160) * 0.22 - this.throttleOffset) * Math.min(1, dt * 3);
      this.camY += this.speed * dt;
      this.terrain.ensure(this.camY, 1);
      this.terrain.update(dt, this.camY, this.speed);

      if (!(this.finished && this.won)) p.update(dt);
      else p.y = this.camY + 190 + this.throttleOffset;
      if (!this.finished) this.level.update(dt);
      for (const gt of this.gates) gt.update(dt);
      if (this.boss) {
        this.boss.update(dt);
        if (this.boss.dead) this.boss = null;
      }

      for (const e of this.enemies) if (!e.dead) e.update(dt);
      this.enemies = this.enemies.filter((e) => !e.dead && !e.gone);

      this.updateBullets(dt);
      this.updateMissiles(dt);

      for (const pk of this.pickups) pk.update(dt);
      this.pickups = this.pickups.filter((x) => !x.dead);
      for (const r of this.rings) r.update(dt);
      this.rings = this.rings.filter((x) => !x.dead);

      // przeloty przez bramy
      for (const gt of this.gates) {
        if (!gt.passed && p.y >= gt.y) {
          gt.passed = true;
          if (gt.active && p.alive && p.inv <= 0) {
            p.kill('field');
          }
          gt.active = false;
          this.onSectorPassed();
        }
      }
      this.gates = this.gates.filter((gt) => SY(this, gt.y) < H + 100);

      // combo
      if (this.comboT > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) {
          this.combo = 0;
          this.mult = 1;
        }
      }
      if (p.alive && !this.finished) this.score += this.speed * dt * 0.04;

      // alarm niskiej energii
      if (p.alive && p.energy < 25 && !this.finished) {
        this.lowET -= dt;
        if (this.lowET <= 0) {
          this.lowET = 0.9;
          G.audio.alarm();
        }
      }

      if (this.mode === 'time' && !this.finished) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.message('KONIEC CZASU', '#ffd36a');
          this.finish(true);
        }
      }

      if (this.banner) {
        this.banner.t += dt;
        if (this.banner.t > 3.2) this.banner = null;
      }
      for (const m of this.msgs) m.t += dt;
      this.msgs = this.msgs.filter((m) => m.t < 2.6);
      this.fx.update(dt);
      G.audio.engine(p.alive, G.clamp((this.speed - 95) / 205, 0, 1));

      if (this.finished) {
        this.finishT -= dt;
        if (this.finishT <= 0) this.done = true;
      }
    }

    updateBullets(dt) {
      const p = this.player;
      // pociski gracza
      for (let i = this.pBullets.length - 1; i >= 0; i--) {
        const b = this.pBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        let hit = false;
        if (this.boss && this.boss.hitAt(b.x, b.y, b.dmg)) hit = true;
        if (!hit) {
          for (const e of this.enemies) {
            if (e.dead) continue;
            const rr = e.r + 5;
            if (G.dist2(b.x, b.y, e.x, e.y) < rr * rr) {
              e.hit(b.dmg);
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          this.fx.spark(b.x, b.y, 3, '#ffe08a', 220);
          this.fx.add({ kind: 'glow', img: G.glow('#ffcc66'), x: b.x, y: b.y, vx: 0, vy: 0, life: 0.08, s0: 18, s1: 8 });
        }
        if (hit || b.life <= 0 || SY(this, b.y) < -30 || b.x < -20 || b.x > W + 20) {
          this.pBullets[i] = this.pBullets[this.pBullets.length - 1];
          this.pBullets.pop();
        }
      }
      // pociski wroga
      for (let i = this.eBullets.length - 1; i >= 0; i--) {
        const b = this.eBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        let rm = b.life <= 0;
        const sy = SY(this, b.y);
        if (sy > H + 30 || sy < -80 || b.x < -30 || b.x > W + 30) rm = true;
        if (!rm && p.alive) {
          const rr = b.r + 11;
          if (G.dist2(b.x, b.y, p.x, p.y) < rr * rr) {
            if (p.inv <= 0) {
              p.damage(b.dmg);
              this.fx.spark(b.x, b.y, 6, '#ff9a6a', 260);
            } else this.fx.spark(b.x, b.y, 4, '#8ff6ff', 200);
            rm = true;
          }
        }
        if (rm) {
          this.eBullets[i] = this.eBullets[this.eBullets.length - 1];
          this.eBullets.pop();
        }
      }
      // zderzenia z jednostkami powietrznymi
      if (p.alive) {
        for (const e of this.enemies) {
          if (!e.air || e.dead) continue;
          const rr = e.r + 18;
          if (G.dist2(e.x, e.y, p.x, p.y) < rr * rr) {
            if (p.inv <= 0) p.damage(e.kind === 'gunship' ? 45 : 28);
            e.die();
          }
        }
      }
    }

    findTarget(m) {
      let best = null, bd = 1e12;
      const consider = (x, y, ref) => {
        const sy = SY(this, y);
        if (sy < 10 || sy > H - 60 || y < m.y - 40) return;
        const d = G.dist2(x, y, m.x, m.y);
        if (d < bd) { bd = d; best = ref; }
      };
      for (const e of this.enemies) if (!e.dead && e.kind !== 'mine') consider(e.x, e.y, e);
      if (this.boss) {
        const b = this.boss;
        for (const t of b.turrets) if (t.alive) { const [x, y] = b.partWorld(t); consider(x, y, { boss: b, part: t }); }
        if (!b.shielded()) { const [x, y] = b.partWorld(b.core); consider(x, y, { boss: b, part: b.core }); }
      }
      return best;
    }
    targetPos(t) {
      if (!t) return null;
      if (t.boss) {
        if (t.boss !== this.boss || t.part.alive === false || (t.part === t.boss.core && t.boss.shielded())) return null;
        return t.boss.partWorld(t.part);
      }
      if (t.dead) return null;
      return [t.x, t.y];
    }

    updateMissiles(dt) {
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        m.life -= dt;
        m.age = (m.age || 0) + dt;
        m.retT = (m.retT || 0) - dt;
        if (m.age > 0.12) {
          let tp = this.targetPos(m.target);
          if (!tp || m.retT <= 0) {
            m.target = this.findTarget(m);
            m.retT = 0.25;
            tp = this.targetPos(m.target);
          }
          if (tp) {
            const want = Math.atan2(tp[0] - m.x, tp[1] - m.y);
            const da = G.angleWrap(want - m.ang);
            m.ang += G.clamp(da, -6 * dt, 6 * dt);
          } else {
            m.ang += G.clamp(G.angleWrap(0 - m.ang), -2 * dt, 2 * dt);
          }
        }
        m.spd = Math.min(950, m.spd + 1500 * dt);
        m.x += Math.sin(m.ang) * m.spd * dt;
        m.y += Math.cos(m.ang) * m.spd * dt;
        m.trailT -= dt;
        if (m.trailT <= 0) {
          m.trailT = 0.014;
          const tx = m.x - Math.sin(m.ang) * 9, ty = m.y - Math.cos(m.ang) * 9;
          this.fx.add({ kind: 'smoke', img: G.S.smokeLight, x: tx, y: ty, vx: G.rand(-8, 8), vy: G.rand(-8, 8), life: 0.6, s0: 6, s1: 18, a: 0.45 });
        }
        let hit = false;
        if (this.boss && this.boss.hitAt(m.x, m.y, 8)) hit = true;
        if (!hit) {
          for (const e of this.enemies) {
            if (e.dead) continue;
            const rr = e.r + 8;
            if (G.dist2(m.x, m.y, e.x, e.y) < rr * rr) {
              e.hit(8);
              hit = true;
              break;
            }
          }
        }
        const sy = SY(this, m.y);
        if (hit || m.life <= 0) {
          this.fx.explosion(m.x, m.y, 0.6, {});
          G.audio.explosion(false);
          for (const e of this.enemies) {
            if (!e.dead && G.dist2(m.x, m.y, e.x, e.y) < 55 * 55) e.hit(3);
          }
        }
        if (hit || m.life <= 0 || sy < -60 || m.x < -60 || m.x > W + 60) {
          this.missiles[i] = this.missiles[this.missiles.length - 1];
          this.missiles.pop();
        }
      }
    }

    // ---------- rysowanie ----------
    draw(ctx) {
      const fx = this.fx;
      const sh = fx.shakeAmt;
      ctx.save();
      if (sh > 0) ctx.translate(G.rand(-sh, sh) * 0.6, G.rand(-sh, sh) * 0.6);
      this.terrain.drawGround(ctx, this.camY);
      fx.drawDecals(ctx);
      fx.drawWater(ctx);
      for (const r of this.rings) r.drawShadow(ctx);
      for (const e of this.enemies) if (!e.air) e.draw(ctx);
      if (this.boss) this.boss.draw(ctx);
      for (const gt of this.gates) gt.draw(ctx);
      for (const pk of this.pickups) pk.draw(ctx);
      for (const e of this.enemies) if (e.air) e.drawShadow(ctx);
      if (this.mode !== 'attract') this.player.drawShadow(ctx);
      for (const e of this.enemies) if (e.air) e.draw(ctx);
      for (const r of this.rings) r.draw(ctx);
      this.drawBullets(ctx);
      if (this.mode !== 'attract') this.player.draw(ctx);
      fx.drawTop(ctx);
      this.terrain.drawClouds(ctx);
      fx.drawPopups(ctx);
      ctx.restore();

      ctx.drawImage(G.S.vignette, 0, 0, W, H);
      if (this.mode !== 'attract') {
        const p = this.player;
        let dmgA = 0;
        if (p.alive && p.hull < 35) dmgA = (0.25 + 0.2 * Math.sin(this.time * 6)) * (1 - p.hull / 35);
        dmgA = Math.max(dmgA, p.hurtT * 2);
        if (dmgA > 0) {
          ctx.globalAlpha = Math.min(1, dmgA);
          ctx.drawImage(G.S.damage, 0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }
      if (fx.flash > 0) {
        ctx.fillStyle = `rgba(${fx.flashCol},${Math.min(1, fx.flash)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    drawBullets(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const b of this.pBullets) {
        const sy = SY(this, b.y);
        const rvy = b.vy - this.speed;
        const tx = b.x - b.vx * 0.02, ty = sy + rvy * 0.02;
        ctx.strokeStyle = 'rgba(255,190,60,0.45)';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(b.x, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = '#fff6c8';
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(b.x, sy); ctx.lineTo(tx, ty); ctx.stroke();
      }
      for (const m of this.missiles) {
        const sy = SY(this, m.y);
        const s = 34;
        ctx.drawImage(G.glow('#ff9a3a'), m.x - Math.sin(m.ang) * 10 - s / 2, sy + Math.cos(m.ang) * 10 - s / 2, s, s);
      }
      for (const b of this.eBullets) {
        const sy = SY(this, b.y);
        const s = b.r * 5;
        ctx.drawImage(G.glow(b.col), b.x - s / 2, sy - s / 2, s, s);
        ctx.drawImage(G.glow('#ffffff'), b.x - b.r, sy - b.r, b.r * 2, b.r * 2);
      }
      ctx.restore();
      for (const m of this.missiles) {
        const sy = SY(this, m.y);
        ctx.save();
        ctx.translate(m.x, sy);
        ctx.rotate(m.ang);
        ctx.fillStyle = '#d9dee3';
        ctx.fillRect(-1.8, -8, 3.6, 14);
        ctx.fillStyle = '#e8453c';
        ctx.fillRect(-1.8, -10, 3.6, 3);
        ctx.fillStyle = '#555';
        ctx.fillRect(-4, 4, 8, 2);
        ctx.restore();
      }
    }
  }
  G.Game = Game;
})(window.G);
