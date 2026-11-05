'use strict';
// Sektory, bramy, kaniony, areny bossów i "reżyser" rozmieszczający przeciwników.
(function (G) {
  const W = G.W, H = G.H, TAU = Math.PI * 2;

  const NAMES = [
    'Ujście Delty', 'Zielone Rozlewiska', 'Kanion Wydry', 'Twierdza na Wodzie',
    'Mgliste Mokradła', 'Przełom Skalny', 'Czarny Nurt', 'Serce Delty',
  ];
  G.SECTOR_NAMES = NAMES;

  // Wygląd sektorów: biom terenu + korekcja barwna (pora dnia, pogoda).
  //  sl   – kolor nakładany w trybie soft-light (r,g,b,siła)
  //  sun  – ciepłe światło słońca z lewego górnego rogu
  //  top  – mgiełka atmosfery u góry ekranu, bot – przyciemnienie u dołu
  //  fog  – równomierna mgła, cloud – ilość chmur (mnożnik krycia)
  G.LOOKS = [
    { biome: 0, sl: [255, 205, 150, 0.16], sun: [255, 222, 165, 0.2], top: [255, 236, 205, 0.07], bot: [0, 18, 36, 0.16], fog: 0, cloud: 0 },
    { biome: 1, sl: [215, 255, 205, 0.1], sun: [255, 250, 225, 0.16], top: [215, 240, 255, 0.07], bot: [0, 22, 30, 0.14], fog: 0, cloud: 0 },
    { biome: 2, sl: [255, 172, 95, 0.26], sun: [255, 196, 120, 0.24], top: [255, 205, 150, 0.09], bot: [30, 10, 0, 0.18], fog: 0, cloud: -0.3 },
    { biome: 4, sl: [130, 165, 205, 0.28], sun: [205, 222, 255, 0.07], top: [190, 210, 232, 0.13], bot: [0, 10, 25, 0.22], fog: 0.04, cloud: 0.4 },
    { biome: 3, sl: [175, 205, 190, 0.24], sun: [232, 240, 235, 0.09], top: [222, 234, 232, 0.3], bot: [10, 25, 25, 0.12], fog: 0.13, cloud: 0.8 },
    { biome: 4, sl: [145, 185, 235, 0.22], sun: [222, 236, 255, 0.15], top: [205, 222, 255, 0.09], bot: [0, 8, 24, 0.2], fog: 0.02, cloud: 0 },
    { biome: 1, sl: [95, 75, 165, 0.42], sun: [255, 125, 85, 0.22], top: [255, 135, 95, 0.12], bot: [12, 0, 32, 0.32], fog: 0, cloud: 0.2 },
    { biome: 2, sl: [255, 145, 65, 0.36], sun: [255, 172, 85, 0.3], top: [255, 175, 115, 0.15], bot: [40, 0, 22, 0.22], fog: 0, cloud: 0 },
  ];

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
      this.ringY = 2600;
      this.ringT = 14;
      this.depotY = 1500;
      this.pickY = 2500;
      this.make(0);
    }

    isBoss(i) {
      const c = this.cfg;
      if (this.mode === 'campaign') return c.bosses.includes(i + 1);
      if (this.mode === 'endless') return (i + 1) % c.bossEvery === 0;
      return false;
    }

    // 0..1: jak ciasna i kręta jest rzeka w danym sektorze
    tightness(i) {
      if (this.mode === 'attract') return 0.35;
      if (this.mode === 'time') return G.clamp(i / 5, 0, 1);
      return G.clamp(i / 7, 0, 1);
    }

    make(i) {
      const r = this.rng;
      const prev = this.sectors[i - 1];
      const start = prev ? prev.gateY : -3000;
      let len;
      if (this.mode === 'campaign') len = 5200 + i * 450;
      else if (this.mode === 'time') len = 4200;
      else len = 5000 + Math.min(i, 10) * 300;
      if (!prev) len += 3000;
      const s = { i, start: prev ? start : 0, boss: this.isBoss(i), name: this.mode === 'campaign' ? NAMES[i % NAMES.length] : null };
      s.look = i % G.LOOKS.length;
      const tk = this.tightness(i);
      let layoutEnd;
      if (s.boss) {
        s.arenaY0 = start + len;
        s.arenaY1 = s.arenaY0 + 4600;
        s.gateY = s.arenaY1 + 500;
        this.river.addFeature({ type: 'arena', y0: s.arenaY0, y1: s.arenaY1 });
        layoutEnd = s.arenaY0 - 1000;
      } else {
        s.gateY = start + len;
        layoutEnd = s.gateY - 1050;
      }
      this.river.addZone({ y0: start, y1: s.gateY, biome: G.LOOKS[s.look].biome, look: s.look, wk: G.lerp(1, 0.8, tk) });
      this.river.addFeature({ type: 'gate', y: s.gateY });
      // spokojny odcinek na start
      if (i === 0) this.river.addFeature({ type: 'calm', y0: -2000, y1: 700 });

      // przeplatane rozlewiska (czasem z wyspą) i wąskie, kręte kaniony
      let y = Math.max(start, 0) + (i === 0 ? 1300 : 950);
      let lastCanyon = this.mode !== 'attract' && i === 0;
      while (y < layoutEnd - 600) {
        if (!lastCanyon) {
          const l = 900 + r() * 800 + tk * 900;
          const y1 = Math.min(y + l, layoutEnd);
          if (y1 - y < 550) break;
          const period = G.lerp(1800, 1050, tk) * (0.85 + 0.3 * r());
          const fr = TAU / period;
          // stromość zakrętu ograniczona tak, by przy pełnym ciągu dało się nadążyć w bok
          const amp = Math.min(G.lerp(30, 110, tk) * (0.6 + 0.4 * r()), 0.55 / fr);
          this.river.addFeature({
            type: 'canyon', y0: y, y1,
            w: G.lerp(120, 84, tk) + (r() - 0.5) * 12,
            amp,
            fr,
            ph: r() * TAU,
            s: (r() - 0.5) * 1.0,
          });
          y = y1 + 650 + r() * 450;
          lastCanyon = true;
        } else {
          const l = (i === 0 && y < 2000 ? 600 : 900) + r() * 800;
          if (r() < 0.6 && y + l < layoutEnd - 450) {
            this.river.addFeature({ type: 'island', y0: y, y1: y + l, w: 55 + r() * 70 });
          }
          y += l + 500 + r() * 400;
          lastCanyon = false;
        }
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
        this.nextSpawnY += G.rand(200, 360) / (1 + 0.1 * (d - 1));
        if (g.boss) this.nextSpawnY = Math.max(this.nextSpawnY, top + 200);
      }
      // pływające stacje energii (główne źródło paliwa)
      while (this.depotY < top) {
        const y = this.depotY;
        const sec = this.sectorAt(y);
        if (!(Math.abs(y - sec.gateY) < 420) && !(sec.boss && y > sec.arenaY0 - 300)) {
          const x = g.river.randomWaterX(y, 46);
          if (x !== null) g.enemies.push(new G.Depot(g, x, y));
        }
        this.depotY += G.rand(1500, 2200) * (1 + 0.03 * Math.min(10, g.difficulty - 1));
      }
      // pierścienie energii: rzadszy bonus; przy bossie co pewien czas
      this.ringT -= dt;
      if (this.ringY < top || (g.boss && this.ringT <= 0)) {
        const y = Math.max(this.ringY, top);
        const x = g.river.randomWaterX(y, 45);
        if (x !== null && !(Math.abs(y - this.sectorAt(y).gateY) < 200)) {
          g.rings.push(new G.Ring(g, x, y));
          if (Math.random() < 0.3) {
            for (let k = 1; k <= 2; k++) {
              const yy = y + k * 110;
              const xx = g.river.randomWaterX(yy, 45);
              if (xx !== null) g.rings.push(new G.Ring(g, G.lerp(x, xx, 0.3), yy));
            }
          }
        }
        this.ringY = y + G.rand(2400, 3600);
        this.ringT = 7;
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
      const narrow = R.at(y).rock > 0.5;
      const opts = [
        ['boat', 30],
        ['drone', 18 + d * 3],
        ['turret', 14 + d * 2 + (narrow ? 10 : 0)],
        ['mine', d >= 2 ? 10 + d : 0],
        ['gunship', d >= 3 && !narrow ? 4 + d * 0.8 : 0],
        ['squad', d >= 4 ? 5 + d * 0.5 : 0],
        ['boats2', d >= 3 && !narrow ? 6 : 0],
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
        const n = narrow ? 1 : d >= 5 ? 3 : 2;
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
