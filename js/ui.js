'use strict';
// HUD, ekrany menu, rekordy.
(function (G) {
  const W = G.W, H = G.H, F = G.FONT, TAU = Math.PI * 2;

  // ---------- rekordy ----------
  const KEY = 'ds_scores_v1';
  G.Scores = {
    // wynik trzymany w pamięci: HUD pyta o rekord co klatkę
    all() {
      if (this._c) return this._c;
      try { this._c = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this._c = {}; }
      return this._c;
    },
    get(mode) {
      return this.all()[mode] || [];
    },
    best(mode) {
      const l = this.get(mode);
      return l.length ? l[0].s : 0;
    },
    add(mode, entry) {
      const a = this.all();
      const l = a[mode] || [];
      l.push(entry);
      l.sort((x, y) => y.s - x.s);
      const rank = l.indexOf(entry);
      a[mode] = l.slice(0, 5);
      try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* brak miejsca */ }
      return rank < 5 ? rank : -1;
    },
  };

  // ---------- pomocnicze ----------
  function text(ctx, s, x, y, size, col, align, weight, spacing) {
    ctx.font = `${weight || 600} ${size}px ${F}`;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (spacing && ctx.letterSpacing !== undefined) ctx.letterSpacing = spacing + 'px';
    ctx.fillStyle = col || '#fff';
    ctx.fillText(s, x, y);
    if (spacing && ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  }
  function panel(ctx, x, y, w, h, r, alpha) {
    ctx.save();
    G.roundRect(ctx, x, y, w, h, r || 10);
    ctx.fillStyle = `rgba(6,14,24,${alpha === undefined ? 0.62 : alpha})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  function fmt(n) {
    return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function fmtTime(t) {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${d}`;
  }
  G.UI = { text, panel, fmt };

  function bar(ctx, x, y, w, h, frac, col, segs) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    G.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    const fw = Math.max(0, w * frac);
    if (fw > 0) {
      ctx.save();
      G.roundRect(ctx, x, y, w, h, h / 2);
      ctx.clip();
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, col[0]);
      g.addColorStop(1, col[1]);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, fw, h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, fw, h * 0.4);
      if (segs) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 1; i < segs; i++) ctx.fillRect(x + (w * i) / segs - 0.5, y, 1.5, h);
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(G.glow(col[1]), x + fw - 20, y - 14, 40, h + 28);
      ctx.restore();
    }
  }

  // ---------- HUD ----------
  G.UI.drawHUD = function (ctx, g) {
    const p = g.player;
    // górny pasek
    const tg = ctx.createLinearGradient(0, 0, 0, 96);
    tg.addColorStop(0, 'rgba(3,8,14,0.85)');
    tg.addColorStop(1, 'rgba(3,8,14,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, W, 96);

    text(ctx, 'WYNIK', 20, 22, 12, '#7fd6ff', 'left', 600, 2);
    text(ctx, fmt(g.score), 20, 50, 30, '#ffffff', 'left', 700);
    if (g.mult > 1) {
      ctx.font = `700 30px ${F}`;
      const sw = ctx.measureText(fmt(g.score)).width;
      const pulse = 1 + Math.max(0, g.comboT - 2.2) * 2;
      text(ctx, 'x' + g.mult, 30 + sw, 50, Math.round(22 * pulse), '#ffc04a', 'left', 700);
      ctx.fillStyle = 'rgba(255,192,74,0.7)';
      ctx.fillRect(20, 58, (sw + 40) * G.clamp(g.comboT / 2.4, 0, 1), 3);
    }
    const best = Math.max(G.Scores.best(g.mode), Math.floor(g.score));
    text(ctx, 'REKORD ' + fmt(best), 20, 76, 12, 'rgba(200,230,255,0.6)', 'left', 600, 1);

    // środek: sektor / czas
    if (g.mode === 'time') {
      const low = g.timeLeft < 20;
      text(ctx, 'CZAS', W / 2, 22, 12, '#7fd6ff', 'center', 600, 2);
      text(ctx, fmtTime(g.timeLeft), W / 2, 52, 32, low && Math.floor(g.time * 4) % 2 ? '#ff6a5a' : '#ffffff', 'center', 700);
    } else {
      const s = g.level.sectors[Math.min(g.sectorIdx, g.level.sectors.length - 1)];
      const tot = g.mode === 'campaign' ? ' / ' + g.cfg.sectors : '';
      text(ctx, 'SEKTOR ' + (g.sectorIdx + 1) + tot, W / 2, 26, 16, '#ffffff', 'center', 700, 2);
      if (s) {
        const fr = G.clamp((p.y - s.start) / (s.gateY - s.start), 0, 1);
        const bw = 180;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(W / 2 - bw / 2, 36, bw, 4);
        ctx.fillStyle = '#5fe3ff';
        ctx.fillRect(W / 2 - bw / 2, 36, bw * fr, 4);
        if (s.boss) {
          const bf = (s.arenaY0 - s.start) / (s.gateY - s.start);
          ctx.fillStyle = '#ff5a4a';
          ctx.fillRect(W / 2 - bw / 2 + bw * bf - 2, 33, 4, 10);
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(W / 2 - bw / 2 + bw * fr, 33);
        ctx.lineTo(W / 2 - bw / 2 + bw * fr + 4, 44);
        ctx.lineTo(W / 2 - bw / 2 + bw * fr - 4, 44);
        ctx.fill();
        if (s.name) text(ctx, s.name.toUpperCase(), W / 2, 60, 11, 'rgba(200,230,255,0.6)', 'center', 600, 2);
      }
    }

    // prawa: maszyny i rakiety
    if (g.mode !== 'time') {
      text(ctx, 'MASZYNY', W - 20, 22, 12, '#7fd6ff', 'right', 600, 2);
      const n = Math.min(g.lives, 6);
      for (let i = 0; i < n; i++) G.draw(ctx, G.S.player, W - 30 - i * 26, 42, 0, 0.3, 0.3);
      if (g.lives > 6) text(ctx, '+' + (g.lives - 6), W - 30 - 6 * 26, 48, 14, '#fff', 'right', 700);
    }
    text(ctx, 'RAKIETY', W - 20, 72, 12, '#d49bff', 'right', 600, 2);
    for (let i = 0; i < p.missiles; i++) {
      const x = W - 24 - i * 9;
      ctx.fillStyle = '#e4d2ff';
      ctx.fillRect(x - 2, 79, 4, 12);
      ctx.fillStyle = '#e8453c';
      ctx.fillRect(x - 2, 79, 4, 3);
    }
    if (p.missiles === 0) text(ctx, '—', W - 22, 91, 12, 'rgba(255,255,255,0.4)', 'right', 600);

    // boss
    if (g.boss && g.boss.state !== 'escape') {
      const b = g.boss;
      panel(ctx, 90, 100, W - 180, 34, 8, 0.6);
      text(ctx, b.name + (b.shielded() ? '  ·  OSŁONA AKTYWNA' : '  ·  RDZEŃ ODSŁONIĘTY'), W / 2, 116, 12, b.shielded() ? '#8fe8ff' : '#ff8a7a', 'center', 700, 2);
      bar(ctx, 104, 121, W - 208, 7, b.hpFrac(), ['#ff2a4a', '#ff9a5a']);
    }

    // dolny panel
    const by = H - 78;
    const bgr = ctx.createLinearGradient(0, H - 110, 0, H);
    bgr.addColorStop(0, 'rgba(3,8,14,0)');
    bgr.addColorStop(1, 'rgba(3,8,14,0.85)');
    ctx.fillStyle = bgr;
    ctx.fillRect(0, H - 110, W, 110);

    const e = p.energy / 100;
    const fuel = p.refuelT > 0 && p.alive;
    const ecol = fuel ? ['#3ce8ff', '#e6fdff'] : e > 0.5 ? ['#1fa8ff', '#4ff0ff'] : e > 0.25 ? ['#ffb020', '#ffe45a'] : ['#ff2a2a', '#ff7a4a'];
    text(ctx, fuel ? 'TANKOWANIE' : 'REAKTOR', W / 2 - 150, by + 8, 12, fuel && Math.floor(g.time * 8) % 2 ? '#ffffff' : ecol[1], 'left', 700, 2);
    text(ctx, Math.ceil(p.energy) + '%', W / 2 + 150, by + 8, 13, '#ffffff', 'right', 700);
    if (fuel) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(g.time * 20);
      ctx.drawImage(G.glow('#3ce8ff'), W / 2 - 170, by + 2, 340, 42);
      ctx.restore();
    }
    bar(ctx, W / 2 - 150, by + 16, 300, 14, e, ecol, 20);

    text(ctx, 'PANCERZ', 20, by + 30, 11, '#7dffb0', 'left', 700, 2);
    const hcol = p.hull > 50 ? ['#2fd36a', '#8dffb0'] : p.hull > 25 ? ['#ffb020', '#ffe45a'] : ['#ff2a2a', '#ff7a4a'];
    bar(ctx, 20, by + 38, 120, 8, p.hull / 100, hcol);

    text(ctx, 'BROŃ', W / 2 - 150, by + 54, 11, '#ffbe5c', 'left', 700, 2);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < p.wlevel ? '#ffbe5c' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(W / 2 - 108 + i * 16, by + 46, 12, 9);
    }
    // prędkość
    const sk = G.clamp((g.speed - 95) / 205, 0, 1);
    text(ctx, 'CIĄG', W - 20, by + 30, 11, '#7fd6ff', 'right', 700, 2);
    for (let i = 0; i < 10; i++) {
      const on = i / 10 < sk + 0.05;
      ctx.fillStyle = on ? (i > 7 ? '#ff8a4a' : '#5fe3ff') : 'rgba(255,255,255,0.13)';
      ctx.fillRect(W - 140 + i * 12, by + 38 + (9 - i) * 0.6, 9, 8 - (9 - i) * 0.6);
    }
    text(ctx, Math.round(g.speed * 3.6) + ' km/h', W - 20, by + 62, 11, 'rgba(200,230,255,0.6)', 'right', 600);

    // ostrzeżenie
    if (p.alive && p.energy < 25 && Math.floor(g.time * 3) % 2 === 0) {
      text(ctx, '⚠ NISKA ENERGIA: LEĆ NAD STACJĘ ENERGII', W / 2, H - 120, 15, '#ff6a5a', 'center', 700, 1);
    }

    // komunikaty
    let my = 300;
    for (const m of g.msgs) {
      const a = m.t < 0.15 ? m.t / 0.15 : m.t > 2.1 ? 1 - (m.t - 2.1) / 0.5 : 1;
      ctx.globalAlpha = G.clamp(a, 0, 1);
      const sc = m.t < 0.15 ? 1.3 - m.t * 2 : 1;
      ctx.save();
      ctx.translate(W / 2, my);
      ctx.scale(sc, sc);
      ctx.font = `700 20px ${F}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(m.text, 0, 0);
      ctx.fillStyle = m.col;
      ctx.fillText(m.text, 0, 0);
      ctx.restore();
      my += 30;
    }
    ctx.globalAlpha = 1;

    // baner sektora
    if (g.banner) {
      const b = g.banner, t = b.t;
      const a = t < 0.3 ? t / 0.3 : t > 2.6 ? 1 - (t - 2.6) / 0.6 : 1;
      ctx.save();
      ctx.globalAlpha = G.clamp(a, 0, 1);
      const yy = H * 0.36;
      const lw = G.clamp(t / 0.5, 0, 1) * 260;
      const lg = ctx.createLinearGradient(W / 2 - lw, 0, W / 2 + lw, 0);
      lg.addColorStop(0, 'rgba(95,227,255,0)');
      lg.addColorStop(0.5, b.boss ? 'rgba(255,90,74,0.9)' : 'rgba(95,227,255,0.9)');
      lg.addColorStop(1, 'rgba(95,227,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(W / 2 - lw, yy - 50, lw * 2, 2);
      ctx.fillRect(W / 2 - lw, yy + 30, lw * 2, 2);
      ctx.fillStyle = 'rgba(3,10,18,0.45)';
      ctx.fillRect(W / 2 - lw, yy - 48, lw * 2, 78);
      ctx.font = `700 44px ${F}`;
      ctx.textAlign = 'center';
      if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '8px';
      ctx.shadowColor = b.boss ? '#ff5a4a' : '#3fd0ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(b.title, W / 2, yy);
      ctx.shadowBlur = 0;
      if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
      ctx.font = `600 15px ${F}`;
      ctx.fillStyle = b.boss ? '#ffb0a0' : '#a8ecff';
      ctx.fillText(b.sub.toUpperCase(), W / 2, yy + 22);
      if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
      ctx.restore();
    }
  };

  // ---------- Logo ----------
  function logo(ctx, y, t) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `700 92px ${F}`;
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '10px';
    const g = ctx.createLinearGradient(0, y - 80, 0, y);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#9cecff');
    g.addColorStop(1, '#1aa6e6');
    ctx.shadowColor = 'rgba(40,190,255,0.8)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = g;
    ctx.fillText('DELTA', W / 2 + 5, y);
    ctx.shadowBlur = 0;
    ctx.font = `600 40px ${F}`;
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '22px';
    ctx.fillStyle = '#ffb347';
    ctx.shadowColor = 'rgba(255,140,40,0.7)';
    ctx.shadowBlur = 16;
    ctx.fillText('STRIKE', W / 2 + 11, y + 48);
    ctx.shadowBlur = 0;
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
    // linia
    const lw = 220 + Math.sin(t * 2) * 10;
    const lg = ctx.createLinearGradient(W / 2 - lw, 0, W / 2 + lw, 0);
    lg.addColorStop(0, 'rgba(95,227,255,0)');
    lg.addColorStop(0.5, 'rgba(95,227,255,0.9)');
    lg.addColorStop(1, 'rgba(95,227,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(W / 2 - lw, y + 66, lw * 2, 2);
    ctx.restore();
  }
  G.UI.logo = logo;

  // ---------- Menu ----------
  const MODE_DESC = {
    campaign: ['8 sektorów, 3 forteczne bossy.', 'Wyzwól deltę i dotrzyj do jej serca.'],
    endless: ['Nieskończona rzeka, rosnący poziom trudności.', 'Forteca co 5 sektorów. Jak daleko dolecisz?'],
    time: ['3 minuty na jak najwyższy wynik.', 'Każda brama +10 s, każda strata −15 s.'],
    controls: ['Klawisze, gamepad i sterowanie dotykiem.', ''],
    scores: ['Najlepsze wyniki w każdym trybie.', ''],
  };
  G.UI.MENU = [
    { id: 'campaign', label: 'KAMPANIA' },
    { id: 'endless', label: 'BEZ KOŃCA' },
    { id: 'time', label: 'NA CZAS' },
    { id: 'controls', label: 'STEROWANIE' },
    { id: 'scores', label: 'REKORDY' },
  ];

  G.UI.drawMenu = function (ctx, sel, t, rects) {
    const ov = ctx.createLinearGradient(0, 0, 0, H);
    ov.addColorStop(0, 'rgba(2,8,16,0.55)');
    ov.addColorStop(0.5, 'rgba(2,8,16,0.25)');
    ov.addColorStop(1, 'rgba(2,8,16,0.75)');
    ctx.fillStyle = ov;
    ctx.fillRect(0, 0, W, H);
    logo(ctx, 240, t);
    // myśliwiec
    const jy = 410 + Math.sin(t * 1.6) * 6;
    G.draw(ctx, G.S.playerShadow, W / 2 + 40, jy + 60, 0, 1.1, 1.1, 0.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) ctx.drawImage(G.glow('#4cc9ff'), W / 2 + s * 4.2 - 9, jy + 44, 18, 40 + Math.random() * 8);
    ctx.restore();
    G.draw(ctx, G.S.player, W / 2, jy, Math.sin(t * 0.9) * 0.05, 1.3 * (1 - Math.abs(Math.sin(t * 0.9)) * 0.15), 1.3);

    const items = G.UI.MENU;
    rects.length = 0;
    let y = 530;
    items.forEach((it, i) => {
      const on = i === sel;
      const w = 300, h = 46;
      const x = W / 2 - w / 2;
      rects.push({ x, y: y - 31, w, h, i });
      if (on) {
        ctx.save();
        G.roundRect(ctx, x, y - 31, w, h, 8);
        const bg = ctx.createLinearGradient(x, 0, x + w, 0);
        bg.addColorStop(0, 'rgba(40,180,255,0.05)');
        bg.addColorStop(0.5, 'rgba(40,180,255,0.28)');
        bg.addColorStop(1, 'rgba(40,180,255,0.05)');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,220,255,0.6)';
        ctx.stroke();
        ctx.restore();
        const ax = 18 + Math.sin(t * 6) * 4;
        ctx.fillStyle = '#5fe3ff';
        ctx.beginPath(); ctx.moveTo(x + ax, y - 16); ctx.lineTo(x + ax + 9, y - 8); ctx.lineTo(x + ax, y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + w - ax, y - 16); ctx.lineTo(x + w - ax - 9, y - 8); ctx.lineTo(x + w - ax, y); ctx.fill();
      }
      text(ctx, it.label, W / 2, y, on ? 24 : 21, on ? '#ffffff' : 'rgba(200,225,245,0.65)', 'center', 700, 4);
      y += 54;
    });
    const id = items[sel].id;
    const d = MODE_DESC[id];
    text(ctx, d[0], W / 2, y + 12, 15, '#bfe6ff', 'center', 500);
    text(ctx, d[1], W / 2, y + 34, 15, '#bfe6ff', 'center', 500);
    if (G.MODES[id]) {
      const b = G.Scores.best(id);
      text(ctx, 'REKORD: ' + fmt(b), W / 2, y + 66, 14, '#ffc04a', 'center', 700, 2);
    }
    text(ctx, '↑↓ wybór   ·   ENTER start   ·   M muzyka: ' + (G.audio.musicOn ? 'wł.' : 'wył.'), W / 2, H - 24, 13, 'rgba(200,225,245,0.5)', 'center', 500);
  };

  G.UI.drawControls = function (ctx, t) {
    ctx.fillStyle = 'rgba(2,8,16,0.72)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'STEROWANIE', W / 2, 130, 34, '#ffffff', 'center', 700, 6);
    const rows = [
      ['← → / A D', 'Skręt'],
      ['↑ / W', 'Przyspieszenie (więcej punktów, większe zużycie)'],
      ['↓ / S', 'Hamowanie'],
      ['SPACJA / Z / J', 'Działka (przytrzymaj)'],
      ['X / K / SHIFT', 'Para rakiet samonaprowadzających'],
      ['P / ESC', 'Pauza'],
      ['M', 'Muzyka wł./wył.'],
      ['Gamepad', 'Gałka – lot, A – ogień, X/RB – rakiety, Start – pauza'],
      ['Dotyk', 'Przeciągnij – lot i ogień, dwa palce – rakiety'],
    ];
    let y = 200;
    panel(ctx, 50, 170, W - 100, rows.length * 44 + 30, 12);
    for (const [k, v] of rows) {
      text(ctx, k, 80, y + 24, 15, '#5fe3ff', 'left', 700);
      text(ctx, v, 250, y + 24, 14, '#e2f2ff', 'left', 500);
      y += 44;
    }
    y += 50;
    const tips = [
      'Brzeg i każde zderzenie z wrogiem to koniec lotu. Trzymaj się nurtu.',
      'Reaktor stale się wyczerpuje. Leć nad pływającą stacją energii,',
      'najlepiej zwalniając. Nie strzelaj w nią! Pierścienie to bonus.',
      'Bramy z polem siłowym otwierasz, niszcząc oba generatory na brzegach.',
      'Szybkie serie zestrzeleń podnoszą mnożnik punktów (do x8).',
    ];
    for (const s of tips) {
      text(ctx, s, W / 2, y, 14, '#bfe6ff', 'center', 500);
      y += 24;
    }
    text(ctx, 'ESC / ENTER – powrót', W / 2, H - 40, 14, 'rgba(200,225,245,0.6)', 'center', 600);
    void t;
  };

  G.UI.drawScores = function (ctx) {
    ctx.fillStyle = 'rgba(2,8,16,0.72)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'REKORDY', W / 2, 130, 34, '#ffffff', 'center', 700, 6);
    let y = 180;
    for (const id of ['campaign', 'endless', 'time']) {
      panel(ctx, 70, y, W - 140, 200, 12);
      text(ctx, G.MODES[id].name, W / 2, y + 32, 18, '#ffc04a', 'center', 700, 4);
      const l = G.Scores.get(id);
      if (!l.length) text(ctx, 'brak wyników', W / 2, y + 100, 14, 'rgba(255,255,255,0.4)', 'center', 500);
      l.forEach((e, i) => {
        const yy = y + 62 + i * 27;
        text(ctx, i + 1 + '.', 110, yy, 15, '#5fe3ff', 'left', 700);
        text(ctx, fmt(e.s), 150, yy, 16, '#ffffff', 'left', 700);
        text(ctx, e.info || '', W - 110, yy, 13, 'rgba(200,225,245,0.6)', 'right', 500);
      });
      y += 220;
    }
    text(ctx, 'ESC / ENTER – powrót', W / 2, H - 40, 14, 'rgba(200,225,245,0.6)', 'center', 600);
  };

  G.UI.drawPause = function (ctx, sel, rects) {
    ctx.fillStyle = 'rgba(2,8,16,0.6)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUZA', W / 2, 330, 48, '#ffffff', 'center', 700, 10);
    const items = ['WZNÓW', 'OD NOWA', 'MENU GŁÓWNE'];
    rects.length = 0;
    items.forEach((s, i) => {
      const y = 430 + i * 58;
      const on = i === sel;
      rects.push({ x: W / 2 - 140, y: y - 32, w: 280, h: 46, i });
      if (on) {
        ctx.save();
        G.roundRect(ctx, W / 2 - 140, y - 32, 280, 46, 8);
        ctx.fillStyle = 'rgba(40,180,255,0.22)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,220,255,0.6)';
        ctx.stroke();
        ctx.restore();
      }
      text(ctx, s, W / 2, y, on ? 23 : 20, on ? '#fff' : 'rgba(200,225,245,0.65)', 'center', 700, 4);
    });
  };

  G.UI.drawResults = function (ctx, r, t) {
    const a = G.clamp(t / 0.6, 0, 1);
    ctx.fillStyle = `rgba(2,8,16,${0.7 * a})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    const title = r.won ? (r.mode === 'time' ? 'KONIEC CZASU' : 'DELTA WYZWOLONA') : 'KONIEC GRY';
    ctx.save();
    ctx.shadowColor = r.won ? '#3fd0ff' : '#ff5a4a';
    ctx.shadowBlur = 24;
    text(ctx, title, W / 2, 250, 46, '#ffffff', 'center', 700, 6);
    ctx.restore();
    text(ctx, G.MODES[r.mode].name, W / 2, 290, 16, '#a8ecff', 'center', 600, 4);
    panel(ctx, 90, 330, W - 180, 300, 14);
    text(ctx, 'WYNIK', W / 2, 375, 14, '#7fd6ff', 'center', 600, 3);
    text(ctx, fmt(r.score), W / 2, 430, 54, '#ffffff', 'center', 700);
    if (r.rank === 0 && Math.floor(t * 3) % 2 === 0) text(ctx, 'NOWY REKORD!', W / 2, 466, 18, '#ffc04a', 'center', 700, 3);
    else if (r.rank > 0) text(ctx, r.rank + 1 + '. MIEJSCE W TABELI', W / 2, 466, 15, '#ffc04a', 'center', 700, 2);
    const rows = [
      ['Sektor', String(r.sector)],
      ['Zestrzelenia', String(r.kills)],
      ['Pierścienie energii', String(r.rings)],
      ['Bramy otwarte', String(r.gates)],
    ];
    rows.forEach(([k, v], i) => {
      const y = 510 + i * 27;
      text(ctx, k, 140, y, 15, '#bfe6ff', 'left', 500);
      text(ctx, v, W - 140, y, 16, '#ffffff', 'right', 700);
    });
    if (t > 1) text(ctx, 'ENTER – zagraj ponownie   ·   ESC – menu', W / 2, 700, 15, 'rgba(220,240,255,0.75)', 'center', 600);
    ctx.globalAlpha = 1;
    void TAU;
  };
})(window.G);
