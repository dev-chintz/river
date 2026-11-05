'use strict';
// Sektory, bramy, areny bossów i "reżyser" rozmieszczający przeciwników.
(function (G) {
  const W = G.W, H = G.H;

  const NAMES = [
    'Ujście Delty', 'Zielone Rozlewiska', 'Kanion Wydry', 'Twierdza na Wodzie',
    'Mgliste Mokradła', 'Przełom Skalny', 'Czarny Nurt', 'Serce Delty',
  ];
  G.SECTOR_NAMES = NAMES;

  G.MODES = {
    campaign: { name: 'KAMPANIA', sectors: 8, bosses: [3, 6, 8], lives: 3 },
    endless: { name: 'BEZ KOŃCA', sectors: Infinity, bossEvery: 5, lives: 3 },
    time: { name: 'NA CZAS', sectors: Infinity, lives: Infinity, time: 180 },
    attract: { name: '', sectors: Infinity },
  };

  class Level {
    constructor(g, mode, seed) {
      this.g = g;
      this.mode = mode;
      this.cfg = G.MODES[mode];
      this.seed = seed;
      this.river = new G.River(seed);
      this.rng = G.rng(seed * 3 + 1);
      this.sectors = [];
      this.nextSpawnY = 900;
      this.ringY = 700;
      this.ringT = 5;
      this.pickY = 2500;
      this.make(0);
    }

    isBoss(i) {
      const c = this.cfg;
      if (this.mode === 'campaign') return c.bosses.includes(i + 1);
      if (this.mode === 'endless') return (i + 1) % c.bossEvery === 0;
      return false;
    }

    make(i) {
      const r = this.rng;
      const prev = this.sectors[i - 1];
      const start = prev ? prev.gateY : 0;
      let len;
      if (this.mode === 'campaign') len = 5200 + i * 450;
      else if (this.mode === 'time') len = 4200;
      else len = 5000 + Math.min(i, 10) * 300;
      const s = { i, start, boss: this.isBoss(i), name: this.mode === 'campaign' ? NAMES[i % NAMES.length] : null };
      let islandEnd;
      if (s.boss) {
        s.arenaY0 = start + len;
        s.arenaY1 = s.arenaY0 + 4600;
        s.gateY = s.arenaY1 + 500;
        this.river.addFeature({ type: 'arena', y0: s.arenaY0, y1: s.arenaY1 });
        islandEnd = s.arenaY0 - 1100;
      } else {
        s.gateY = start + len;
        islandEnd = s.gateY - 1100;
      }
      this.river.addFeature({ type: 'gate', y: s.gateY });
      // spokojny odcinek na start
      if (i === 0) this.river.addFeature({ type: 'calm', y0: -2000, y1: 700 });
      // wyspy
      let y = start + 1000 + r() * 600;
      while (y < islandEnd - 700) {
        const l = 700 + r() * 900;
        if (y + l > islandEnd) break;
        this.river.addFeature({ type: 'island', y0: y, y1: y + l, w: 55 + r() * 70 });
        y += l + 900 + r() * 1700;
      }
      this.sectors.push(s);
      return s;
    }

    ensure(camY) {
      while (this.sectors.length < this.cfg.sectors && this.sectors[this.sectors.length - 1].gateY < camY + 6000) {
        this.make(this.sectors.length);
      }
      this.river.prune(camY);
    }

    sectorAt(y) {
      for (const s of this.sectors) if (y < s.gateY) return s;
      return this.sectors[this.sectors.length - 1];
    }

    noSpawnZone(y) {
      for (const s of this.sectors) {
        if (Math.abs(y - s.gateY) < 380) return true;
        if (s.boss && y > s.arenaY0 - 200 && y < s.arenaY1 + 200) return true;
      }
      return y < 800;
    }

    update(dt) {
      const g = this.g;
      if (this.mode === 'attract') return;
      const top = g.camY + H + 70;
      // bramy
      for (const s of this.sectors) {
        if (!s.gateSpawned && top > s.gateY - 40) {
          s.gateSpawned = true;
          s.gate = new G.Gate(g, s.gateY);
          g.gates.push(s.gate);
        }
        if (s.boss && !s.bossSpawned && g.player.y > s.arenaY0 - 200) {
          s.bossSpawned = true;
          g.startBoss(s);
        }
      }
      // przeciwnicy
      while (this.nextSpawnY < top) {
        const y = this.nextSpawnY;
        if (!this.noSpawnZone(y) && !g.boss) this.spawnAt(y);
        const d = g.difficulty;
        this.nextSpawnY += G.rand(170, 330) / (1 + 0.11 * (d - 1));
        if (g.boss) this.nextSpawnY = Math.max(this.nextSpawnY, top + 200);
      }
      // pierścienie energii: co dystans lub co czas (przy wolnym przewijaniu)
      this.ringT -= dt;
      const lowE = g.player.energy < 35;
      if (this.ringY < top || this.ringT <= 0) {
        const y = Math.max(this.ringY, top);
        const x = g.river.randomWaterX(y, 45);
        if (x !== null && !(Math.abs(y - (this.sectorAt(y).gateY)) < 200)) {
          g.rings.push(new G.Ring(g, x, y));
          // czasem łańcuch pierścieni
          if (Math.random() < 0.3) {
            for (let k = 1; k <= 2; k++) {
              const yy = y + k * 110;
              const xx = g.river.randomWaterX(yy, 45);
              if (xx !== null) g.rings.push(new G.Ring(g, G.lerp(x, xx, 0.3), yy));
            }
          }
        }
        this.ringY = y + (lowE ? G.rand(450, 650) : G.rand(700, 1050));
        this.ringT = g.boss ? 5 : 9;
      }
      // znajdźki z zaopatrzenia
      if (this.pickY < top) {
        const x = g.river.randomWaterX(this.pickY, 50);
        if (x !== null && !this.noSpawnZone(this.pickY)) {
          const p = g.player;
          let type = Math.random() < 0.45 ? 'W' : Math.random() < 0.5 ? 'M' : 'R';
          if (p.hull < 50) type = 'R';
          if (p.wlevel >= 4 && type === 'W') type = 'M';
          g.pickups.push(new G.Pickup(g, x, this.pickY, type));
        }
        this.pickY += G.rand(2600, 4200);
      }
    }

    spawnAt(y) {
      const g = this.g, d = g.difficulty, R = g.river;
      const opts = [
        ['boat', 30],
        ['drone', 18 + d * 3],
        ['turret', 14 + d * 2],
        ['mine', d >= 2 ? 10 + d : 0],
        ['gunship', d >= 3 ? 4 + d * 0.8 : 0],
        ['squad', d >= 4 ? 5 + d * 0.5 : 0],
        ['boats2', d >= 3 ? 6 : 0],
      ];
      let tot = 0;
      for (const o of opts) tot += o[1];
      let r = Math.random() * tot, type = 'boat';
      for (const o of opts) {
        r -= o[1];
        if (r <= 0) { type = o[0]; break; }
      }
      if (type === 'gunship' && g.enemies.some((e) => e.kind === 'gunship' && !e.dead)) type = 'drone';
      if (type === 'boat' || type === 'boats2') {
        const n = type === 'boats2' ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const yy = y + i * 70;
          const x = R.randomWaterX(yy, 34);
          if (x !== null) g.enemies.push(new G.Boat(g, x, yy));
        }
      } else if (type === 'mine') {
        const n = d >= 5 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const yy = y + i * G.rand(50, 90);
          const x = R.randomWaterX(yy, 28);
          if (x !== null) g.enemies.push(new G.Mine(g, x, yy));
        }
      } else if (type === 'turret') {
        const e = R.at(y);
        const cands = [];
        // na samym brzegu, w zasięgu działek
        const off = G.rand(2, 12);
        if (e.l - off > 24) cands.push(e.l - off);
        if (e.r + off < W - 24) cands.push(e.r + off);
        if (e.il >= 0 && e.ir - e.il > 50) cands.push(e.il + 12, e.ir - 12);
        if (cands.length) g.enemies.push(new G.Turret(g, G.pick(cands), y));
        else this.spawnDrone(y);
      } else if (type === 'gunship') {
        g.enemies.push(new G.Gunship(g, G.rand(120, W - 120)));
      } else if (type === 'squad') {
        const cx = G.rand(140, W - 140);
        const n = d >= 7 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const k = i - (n - 1) / 2;
          g.enemies.push(new G.Drone(g, cx + k * 48, y + Math.abs(k) * 50, { straight: true, desc: 170, kamikaze: false }));
        }
      } else {
        this.spawnDrone(y);
      }
    }

    spawnDrone(y) {
      this.g.enemies.push(new G.Drone(this.g, G.rand(70, W - 70), y));
    }
  }
  G.Level = Level;
})(window.G);
