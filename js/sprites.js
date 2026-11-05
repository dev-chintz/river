'use strict';
// Proceduralnie rysowane sprite'y (renderowane raz, w 2x rozdzielczości).
(function (G) {
  const S = {};
  G.S = S;
  const TAU = Math.PI * 2;

  function lin(x, x0, y0, x1, y1, stops) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function rad(x, cx, cy, r0, r1, stops, fx, fy) {
    const g = x.createRadialGradient(fx === undefined ? cx : fx, fy === undefined ? cy : fy, r0, cx, cy, r1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function poly(x, pts, mirror) {
    x.beginPath();
    pts.forEach(([a, b], i) => (i ? x.lineTo(mirror ? -a : a, b) : x.moveTo(mirror ? -a : a, b)));
    x.closePath();
  }
  function both(x, pts, fill) {
    x.fillStyle = fill;
    poly(x, pts, false);
    x.fill();
    poly(x, pts, true);
    x.fill();
  }

  // ---------- Gracz: myśliwiec deltowy ----------
  function drawJet(x) {
    const wing = lin(x, -36, 0, 36, 0, [
      [0, '#34414d'], [0.3, '#7d8d9c'], [0.5, '#5f6e7d'], [0.7, '#6a7a89'], [1, '#2c3843'],
    ]);
    // główne skrzydła
    x.fillStyle = wing;
    poly(x, [[6, -8], [35, 15], [35, 22], [7, 18], [-7, 18], [-35, 22], [-35, 15], [-6, -8]]);
    x.fill();
    // ciemniejsza krawędź spływu
    x.fillStyle = 'rgba(20,28,36,0.45)';
    poly(x, [[7, 15], [35, 19], [35, 22], [7, 18]]);
    x.fill();
    poly(x, [[7, 15], [35, 19], [35, 22], [7, 18]], true);
    x.fill();
    // kamuflaż na skrzydłach
    x.fillStyle = 'rgba(30,40,52,0.28)';
    poly(x, [[12, 2], [24, 10], [20, 15], [10, 12]]);
    x.fill();
    poly(x, [[14, 0], [22, 8], [16, 12], [9, 8]], true);
    x.fill();
    // końcówki skrzydeł
    both(x, [[28, 10], [35, 15], [35, 22], [28, 21]], '#ff7a2f');
    both(x, [[33, 14], [35, 15], [35, 22], [33, 22]], '#ffd2a8');
    // stateczniki
    both(x, [[5, 20], [18, 31], [18, 35], [5, 32]], wing);
    // kaczki
    both(x, [[5, -20], [14, -13], [14, -10], [5, -12]], '#6d7c8b');
    // linie paneli
    x.strokeStyle = 'rgba(10,15,20,0.35)';
    x.lineWidth = 0.6;
    x.beginPath();
    x.moveTo(-30, 17); x.lineTo(-10, 4);
    x.moveTo(30, 17); x.lineTo(10, 4);
    x.moveTo(-22, 19); x.lineTo(-22, 9);
    x.moveTo(22, 19); x.lineTo(22, 9);
    x.stroke();
    // podświetlenie krawędzi natarcia
    x.strokeStyle = 'rgba(255,255,255,0.45)';
    x.lineWidth = 0.9;
    x.beginPath();
    x.moveTo(-6, -8); x.lineTo(-35, 15);
    x.moveTo(6, -8); x.lineTo(35, 15);
    x.stroke();
    // kadłub
    x.fillStyle = lin(x, -8, 0, 8, 0, [[0, '#4d5a66'], [0.35, '#e3eaf0'], [0.6, '#a8b6c2'], [1, '#3f4b56']]);
    x.beginPath();
    x.moveTo(0, -42);
    x.quadraticCurveTo(5, -32, 6, -18);
    x.lineTo(7.5, 22);
    x.lineTo(6, 34);
    x.lineTo(-6, 34);
    x.lineTo(-7.5, 22);
    x.lineTo(-6, -18);
    x.quadraticCurveTo(-5, -32, 0, -42);
    x.fill();
    // wloty powietrza
    x.fillStyle = '#1d242c';
    x.fillRect(-9.5, -6, 2.5, 10);
    x.fillRect(7, -6, 2.5, 10);
    // stożek nosa
    x.fillStyle = '#2b333c';
    x.beginPath();
    x.moveTo(0, -42);
    x.quadraticCurveTo(2.6, -37, 3.2, -32);
    x.lineTo(-3.2, -32);
    x.quadraticCurveTo(-2.6, -37, 0, -42);
    x.fill();
    // pasy
    x.fillStyle = '#e8453c';
    x.fillRect(-1.2, -4, 2.4, 18);
    x.fillStyle = '#ffffff';
    x.fillRect(-0.4, -4, 0.8, 18);
    // stateczniki pionowe
    x.fillStyle = lin(x, -6, 0, 6, 0, [[0, '#2a333c'], [0.5, '#6c7a87'], [1, '#2a333c']]);
    x.fillRect(-6, 12, 2.2, 21);
    x.fillRect(3.8, 12, 2.2, 21);
    // dysze
    x.fillStyle = '#161b21';
    x.beginPath(); x.ellipse(-3.2, 34, 2.8, 2.2, 0, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(3.2, 34, 2.8, 2.2, 0, 0, TAU); x.fill();
    x.fillStyle = '#ff9a4a';
    x.beginPath(); x.ellipse(-3.2, 34.5, 1.4, 1, 0, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(3.2, 34.5, 1.4, 1, 0, 0, TAU); x.fill();
    // kabina
    x.fillStyle = lin(x, -3, -28, 3, -8, [[0, '#d4fbff'], [0.35, '#2fb4ea'], [1, '#08304d']]);
    x.beginPath(); x.ellipse(0, -18, 3.8, 9.5, 0, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(20,30,40,0.8)';
    x.lineWidth = 0.7;
    x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.8)';
    x.beginPath(); x.ellipse(-1.3, -21, 1, 3.4, -0.15, 0, TAU); x.fill();
  }

  // ---------- Łódź patrolowa ----------
  function drawBoat(x) {
    // kadłub
    x.fillStyle = lin(x, -12, 0, 12, 0, [[0, '#3f474e'], [0.35, '#c3ccd3'], [0.6, '#98a2aa'], [1, '#3a4249']]);
    x.beginPath();
    x.moveTo(0, -32);
    x.quadraticCurveTo(11, -18, 12, 0);
    x.lineTo(11, 26);
    x.quadraticCurveTo(0, 31, -11, 26);
    x.lineTo(-12, 0);
    x.quadraticCurveTo(-11, -18, 0, -32);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    x.lineWidth = 0.8;
    x.stroke();
    // pokład
    x.fillStyle = '#7b858d';
    x.beginPath();
    x.moveTo(0, -26);
    x.quadraticCurveTo(8, -15, 8.5, 0);
    x.lineTo(8, 23);
    x.lineTo(-8, 23);
    x.lineTo(-8.5, 0);
    x.quadraticCurveTo(-8, -15, 0, -26);
    x.fill();
    // pas czerwony
    x.fillStyle = '#c63a2e';
    x.beginPath();
    x.moveTo(-10.5, -12); x.lineTo(10.5, -12); x.lineTo(11.3, -7); x.lineTo(-11.3, -7);
    x.fill();
    // nadbudówka
    x.fillStyle = lin(x, -6, -2, 6, 14, [[0, '#f2f5f7'], [1, '#aab3ba']]);
    G.roundRect(x, -6.5, -2, 13, 16, 2);
    x.fill();
    x.fillStyle = '#1e2a35';
    x.fillRect(-5.5, -1, 11, 3);
    x.fillStyle = '#6fc8ff';
    x.fillRect(-4.5, -0.5, 2, 2);
    x.fillRect(-1, -0.5, 2, 2);
    x.fillRect(2.5, -0.5, 2, 2);
    // radar
    x.fillStyle = '#39424a';
    x.fillRect(-1, 6, 2, 6);
    x.fillStyle = '#d7dde2';
    x.fillRect(-4, 8, 8, 1.5);
    // działko
    x.fillStyle = '#2a3036';
    x.fillRect(-1.2, -26, 2.4, 12);
    x.fillStyle = rad(x, -1, -15, 0.5, 5, [[0, '#8f99a2'], [1, '#2d343a']]);
    x.beginPath(); x.arc(0, -14, 4.5, 0, TAU); x.fill();
    // rufa
    x.fillStyle = '#2b3137';
    x.fillRect(-6, 20, 12, 3);
  }

  // ---------- Dron bojowy ----------
  function drawDrone(x) {
    x.strokeStyle = '#262c33';
    x.lineWidth = 4;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-15, -15); x.lineTo(15, 15);
    x.moveTo(15, -15); x.lineTo(-15, 15);
    x.stroke();
    x.strokeStyle = '#59636e';
    x.lineWidth = 1.4;
    x.stroke();
    for (const [a, b] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
      x.fillStyle = rad(x, a, b, 0.5, 4.5, [[0, '#7c8794'], [1, '#1f242a']], a - 1, b - 1);
      x.beginPath(); x.arc(a, b, 4.2, 0, TAU); x.fill();
    }
    // korpus
    x.fillStyle = rad(x, 0, 0, 1, 12, [[0, '#6f7a86'], [0.6, '#3a424b'], [1, '#1b2026']], -3, -4);
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const px = Math.cos(a) * 11, py = Math.sin(a) * 11;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = '#ffb02e';
    x.lineWidth = 1.2;
    x.stroke();
    x.fillStyle = '#ffb02e';
    x.fillRect(-1, -11, 2, 4);
    // oko
    x.fillStyle = '#300';
    x.beginPath(); x.arc(0, 2, 4.8, 0, TAU); x.fill();
  }

  // ---------- Śmigłowiec szturmowy ----------
  function drawGunship(x) {
    // belka ogonowa
    x.fillStyle = lin(x, -4, 0, 4, 0, [[0, '#2f3a28'], [0.5, '#6c7d56'], [1, '#2f3a28']]);
    x.beginPath();
    x.moveTo(-4, 14); x.lineTo(4, 14); x.lineTo(2.5, 46); x.lineTo(-2.5, 46);
    x.fill();
    // statecznik
    x.fillStyle = '#55653f';
    G.roundRect(x, -12, 38, 24, 5, 2);
    x.fill();
    // skrzydełka z zasobnikami
    x.fillStyle = '#3d4a31';
    G.roundRect(x, -27, -3, 54, 7, 3);
    x.fill();
    for (const s of [-1, 1]) {
      for (const o of [17, 24]) {
        x.fillStyle = rad(x, s * o, 1, 0.5, 4, [[0, '#9aa38a'], [1, '#252b20']], s * o - 1, 0);
        x.beginPath(); x.arc(s * o, 1, 3.4, 0, TAU); x.fill();
        x.fillStyle = '#111';
        x.beginPath(); x.arc(s * o, 1, 1.3, 0, TAU); x.fill();
      }
    }
    // kadłub
    x.fillStyle = lin(x, -14, 0, 14, 0, [[0, '#2c3625'], [0.35, '#7f9165'], [0.6, '#5d6e49'], [1, '#283121']]);
    x.beginPath();
    x.moveTo(0, -36);
    x.quadraticCurveTo(14, -26, 13, -4);
    x.quadraticCurveTo(11, 13, 4, 18);
    x.lineTo(-4, 18);
    x.quadraticCurveTo(-11, 13, -13, -4);
    x.quadraticCurveTo(-14, -26, 0, -36);
    x.fill();
    // kamuflaż
    x.fillStyle = 'rgba(30,38,24,0.45)';
    x.beginPath(); x.ellipse(-5, 2, 5, 8, 0.4, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(6, -8, 4, 6, -0.3, 0, TAU); x.fill();
    // kokpit
    x.fillStyle = lin(x, -6, -34, 6, -14, [[0, '#e4fbff'], [0.4, '#58b9d9'], [1, '#0e2f40']]);
    x.beginPath(); x.ellipse(0, -24, 6.5, 10, 0, 0, TAU); x.fill();
    x.strokeStyle = '#1a2216';
    x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(-6.5, -22); x.lineTo(6.5, -22); x.stroke();
    // piasta wirnika
    x.fillStyle = '#20261c';
    x.beginPath(); x.arc(0, -2, 4, 0, TAU); x.fill();
    // znaki
    x.fillStyle = '#d33';
    x.beginPath(); x.arc(0, 8, 2.4, 0, TAU); x.fill();
  }

  // ---------- Wieżyczka lądowa ----------
  function drawTurretBase(x) {
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath(); x.ellipse(3, 4, 20, 20, 0, 0, TAU); x.fill();
    x.fillStyle = lin(x, -18, -18, 18, 18, [[0, '#b6b2a6'], [1, '#5b5850']]);
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const px = Math.cos(a) * 19, py = Math.sin(a) * 19;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.4)';
    x.lineWidth = 1;
    x.stroke();
    // pasy ostrzegawcze
    x.save();
    x.beginPath(); x.arc(0, 0, 15, 0, TAU); x.arc(0, 0, 12, 0, TAU, true); x.clip();
    for (let i = 0; i < 16; i++) {
      x.fillStyle = i % 2 ? '#1c1c1c' : '#e8b62c';
      x.beginPath(); x.moveTo(0, 0);
      x.arc(0, 0, 16, (i / 16) * TAU, ((i + 1) / 16) * TAU);
      x.fill();
    }
    x.restore();
    x.fillStyle = '#3d3f42';
    x.beginPath(); x.arc(0, 0, 12, 0, TAU); x.fill();
  }
  function drawTurretHead(x) {
    x.fillStyle = '#1e2329';
    x.fillRect(-4.5, -22, 3, 16);
    x.fillRect(1.5, -22, 3, 16);
    x.fillStyle = '#5d6772';
    x.fillRect(-4.5, -22, 3, 2);
    x.fillRect(1.5, -22, 3, 2);
    x.fillStyle = rad(x, 0, 0, 1, 11, [[0, '#a2adb8'], [0.6, '#56606b'], [1, '#262c33']], -3, -3);
    x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.fill();
    x.fillStyle = '#c53a2c';
    x.fillRect(-1, 3, 2, 5);
  }

  // ---------- Mina ----------
  function drawMine(x) {
    x.strokeStyle = '#2d3238';
    x.lineWidth = 2.4;
    x.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      x.beginPath();
      x.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      x.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
      x.stroke();
    }
    x.fillStyle = '#808a93';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      x.beginPath(); x.arc(Math.cos(a) * 14, Math.sin(a) * 14, 1.6, 0, TAU); x.fill();
    }
    x.fillStyle = rad(x, 0, 0, 1, 10, [[0, '#b7c0c8'], [0.5, '#5b646d'], [1, '#22272c']], -3, -3);
    x.beginPath(); x.arc(0, 0, 9.5, 0, TAU); x.fill();
    x.strokeStyle = '#e0b030';
    x.lineWidth = 1.5;
    x.beginPath(); x.arc(0, 0, 6.5, 0, TAU); x.stroke();
  }

  // ---------- Generator pola (bramy) ----------
  function drawPylon(x) {
    x.fillStyle = 'rgba(0,0,0,0.4)';
    x.beginPath(); x.ellipse(4, 5, 25, 25, 0, 0, TAU); x.fill();
    x.fillStyle = lin(x, -24, -24, 24, 24, [[0, '#7c8794'], [1, '#2a3038']]);
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * 24, py = Math.sin(a) * 24;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = '#151a20';
    x.lineWidth = 1.5;
    x.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      x.fillStyle = '#e8b62c';
      x.beginPath(); x.arc(Math.cos(a) * 18, Math.sin(a) * 18, 2, 0, TAU); x.fill();
    }
    x.fillStyle = rad(x, 0, 0, 2, 15, [[0, '#4a5563'], [1, '#14181d']]);
    x.beginPath(); x.arc(0, 0, 14, 0, TAU); x.fill();
    x.strokeStyle = '#9fb0c2';
    x.lineWidth = 1;
    x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.stroke();
  }

  // ---------- Boss: forteca poduszkowa ----------
  function drawBoss(x) {
    // fartuch poduszki
    x.fillStyle = '#17191c';
    G.roundRect(x, -160, -100, 320, 200, 64);
    x.fill();
    x.strokeStyle = '#2b2f34';
    x.lineWidth = 3;
    x.stroke();
    // pokład
    x.fillStyle = lin(x, -150, 0, 150, 0, [[0, '#4a535c'], [0.3, '#9ea8b1'], [0.55, '#808a94'], [1, '#3e464e']]);
    G.roundRect(x, -146, -88, 292, 172, 54);
    x.fill();
    // płyty pancerne
    x.strokeStyle = 'rgba(20,25,30,0.4)';
    x.lineWidth = 1;
    x.beginPath();
    for (let i = -120; i <= 120; i += 40) { x.moveTo(i, -84); x.lineTo(i, 80); }
    x.moveTo(-140, -30); x.lineTo(140, -30);
    x.moveTo(-140, 40); x.lineTo(140, 40);
    x.stroke();
    // dziób (dół ekranu) z pasami
    x.save();
    G.roundRect(x, -146, -88, 292, 172, 54);
    x.clip();
    for (let i = -16; i < 16; i++) {
      x.fillStyle = i % 2 ? '#1a1a1a' : '#e2ac24';
      x.beginPath();
      x.moveTo(i * 20, 66); x.lineTo(i * 20 + 10, 66); x.lineTo(i * 20 + 22, 86); x.lineTo(i * 20 + 12, 86);
      x.fill();
    }
    x.restore();
    // wentylatory napędu (góra)
    for (const s of [-1, 1]) {
      x.fillStyle = '#1e2227';
      x.beginPath(); x.arc(s * 78, -64, 26, 0, TAU); x.fill();
      x.strokeStyle = '#5d6670';
      x.lineWidth = 3;
      x.stroke();
      x.strokeStyle = '#3a4048';
      x.lineWidth = 1.2;
      for (let r = 8; r < 24; r += 5) { x.beginPath(); x.arc(s * 78, -64, r, 0, TAU); x.stroke(); }
    }
    // gniazda wież
    for (const s of [-1, 1]) {
      x.fillStyle = rad(x, s * 100, 10, 5, 34, [[0, '#30363d'], [1, '#14171a']]);
      x.beginPath(); x.arc(s * 100, 10, 32, 0, TAU); x.fill();
      x.strokeStyle = '#e2ac24';
      x.lineWidth = 2;
      x.setLineDash([6, 5]);
      x.beginPath(); x.arc(s * 100, 10, 29, 0, TAU); x.stroke();
      x.setLineDash([]);
    }
    // gniazdo rdzenia
    x.fillStyle = rad(x, 0, -10, 8, 48, [[0, '#3a424b'], [1, '#101316']]);
    x.beginPath(); x.arc(0, -10, 46, 0, TAU); x.fill();
    x.strokeStyle = '#6c7884';
    x.lineWidth = 2;
    x.stroke();
    // oznaczenia
    x.fillStyle = 'rgba(230,60,45,0.85)';
    x.fillRect(-140, -6, 18, 34);
    x.fillRect(122, -6, 18, 34);
    x.fillStyle = 'rgba(255,255,255,0.75)';
    x.font = `700 12px ${G.FONT}`;
    x.textAlign = 'center';
    x.fillText('L-01', 0, 58);
  }
  function drawBossTurret(x) {
    x.fillStyle = '#1a1e23';
    x.fillRect(-7, -38, 5, 26);
    x.fillRect(2, -38, 5, 26);
    x.fillStyle = '#6b7682';
    x.fillRect(-7, -38, 5, 3);
    x.fillRect(2, -38, 5, 3);
    x.fillStyle = rad(x, 0, 0, 2, 22, [[0, '#b7c1ca'], [0.55, '#5f6a75'], [1, '#22272d']], -6, -6);
    x.beginPath(); x.arc(0, 0, 20, 0, TAU); x.fill();
    x.strokeStyle = '#151a1f';
    x.lineWidth = 1.5;
    x.stroke();
    x.fillStyle = '#c33';
    x.fillRect(-6, 8, 12, 3);
  }

  // ---------- Znajdźki ----------
  function drawPickup(color, label) {
    return (x) => {
      x.fillStyle = 'rgba(8,16,24,0.85)';
      x.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        const px = Math.cos(a) * 15, py = Math.sin(a) * 15;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath();
      x.fill();
      x.strokeStyle = color;
      x.lineWidth = 2.2;
      x.stroke();
      x.fillStyle = color;
      x.font = `700 15px ${G.FONT}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(label, 0, 1);
    };
  }

  // ---------- Drzewa, skały, domy ----------
  function drawTreeRound(seed) {
    return (x) => {
      const r = G.rng(seed);
      const pal = [
        ['#9fd068', '#4f8a32', '#1f3d16'],
        ['#8cc25a', '#3f7a2a', '#1a3412'],
        ['#a8c95e', '#5b8a2e', '#24401a'],
        ['#7fb85a', '#2f6a2a', '#143010'],
      ][Math.floor(r() * 4)];
      const blobs = 4 + Math.floor(r() * 4);
      for (let i = 0; i < blobs; i++) {
        const a = r() * TAU, d = r() * 7;
        const bx = Math.cos(a) * d, by = Math.sin(a) * d;
        const br = 7 + r() * 6;
        x.fillStyle = rad(x, bx, by, 0.5, br, [[0, pal[0]], [0.55, pal[1]], [1, pal[2]]], bx - br * 0.4, by - br * 0.45);
        x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill();
      }
      for (let i = 0; i < 10; i++) {
        x.fillStyle = 'rgba(220,255,170,0.25)';
        x.beginPath(); x.arc(-4 + r() * 6 - 3, -4 + r() * 6 - 3, 1 + r() * 1.5, 0, TAU); x.fill();
      }
    };
  }
  function drawPine(seed) {
    return (x) => {
      const r = G.rng(seed);
      const layers = [[15, '#1f4a26', '#0f2a14'], [11, '#2d6634', '#163a1c'], [7, '#3f8445', '#1f4d25'], [3.5, '#5aa55d', '#2f6a35']];
      const rot = r() * TAU;
      for (const [R, c0, c1] of layers) {
        x.fillStyle = rad(x, 0, 0, 0, R, [[0, c0], [1, c1]], -R * 0.3, -R * 0.3);
        x.beginPath();
        const n = 9;
        for (let i = 0; i < n * 2; i++) {
          const a = rot + (i / (n * 2)) * TAU;
          const rr = i % 2 ? R * 0.62 : R;
          i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        x.closePath();
        x.fill();
      }
    };
  }
  function drawRock(seed) {
    return (x) => {
      const r = G.rng(seed);
      const n = 7 + Math.floor(r() * 4);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const rr = 8 + r() * 6;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.8]);
      }
      x.fillStyle = lin(x, -12, -12, 12, 12, [[0, '#c9c4b8'], [0.5, '#8c867b'], [1, '#4e4a43']]);
      x.beginPath();
      pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(40,36,30,0.6)';
      x.lineWidth = 0.8;
      x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.3)';
      x.beginPath(); x.moveTo(pts[n - 2][0], pts[n - 2][1]); x.lineTo(0, -2); x.stroke();
    };
  }
  function drawHouse(roof) {
    return (x) => {
      x.fillStyle = '#d8d0bf';
      x.fillRect(-12, -8, 24, 16);
      x.fillStyle = roof[0];
      x.beginPath(); x.moveTo(-13, -9); x.lineTo(13, -9); x.lineTo(13, 0); x.lineTo(-13, 0); x.fill();
      x.fillStyle = roof[1];
      x.beginPath(); x.moveTo(-13, 0); x.lineTo(13, 0); x.lineTo(13, 9); x.lineTo(-13, 9); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.35)';
      x.lineWidth = 0.8;
      x.strokeRect(-13, -9, 26, 18);
      x.beginPath(); x.moveTo(-13, 0); x.lineTo(13, 0); x.stroke();
      x.fillStyle = '#5a4a40';
      x.fillRect(6, -7, 3, 4);
    };
  }

  G.initSprites = function () {
    S.player = G.sprite(80, 90, drawJet);
    S.playerShadow = G.silhouette(S.player, '#000');
    S.boat = G.sprite(30, 70, drawBoat);
    S.drone = G.sprite(46, 46, drawDrone);
    S.droneShadow = G.silhouette(S.drone, '#000');
    S.gunship = G.sprite(70, 100, drawGunship);
    S.gunshipShadow = G.silhouette(S.gunship, '#000');
    S.turretBase = G.sprite(48, 48, drawTurretBase);
    S.turretHead = G.sprite(30, 50, drawTurretHead);
    S.mine = G.sprite(34, 34, drawMine);
    S.pylon = G.sprite(56, 56, drawPylon);
    S.boss = G.sprite(330, 210, drawBoss);
    S.bossTurret = G.sprite(46, 84, drawBossTurret);
    S.pickW = G.sprite(36, 36, drawPickup('#ffae3c', 'W'));
    S.pickM = G.sprite(36, 36, drawPickup('#c77dff', 'M'));
    S.pickR = G.sprite(36, 36, drawPickup('#5cff8a', '+'));
    S.trees = [];
    for (let i = 0; i < 8; i++) S.trees.push(G.sprite(40, 40, drawTreeRound(100 + i * 13)));
    S.pines = [];
    for (let i = 0; i < 4; i++) S.pines.push(G.sprite(34, 34, drawPine(300 + i * 7)));
    S.treeShadows = S.trees.map((t) => G.silhouette(t, '#000'));
    S.pineShadows = S.pines.map((t) => G.silhouette(t, '#000'));
    S.rocks = [];
    for (let i = 0; i < 4; i++) S.rocks.push(G.sprite(30, 26, drawRock(500 + i * 11)));
    S.houses = [
      G.sprite(28, 20, drawHouse(['#c75b3e', '#8e3a26'])),
      G.sprite(28, 20, drawHouse(['#6f7f8e', '#46535f'])),
      G.sprite(28, 20, drawHouse(['#b98b4e', '#7d5a2c'])),
    ];
    S.houseShadow = G.silhouette(S.houses[0], '#000');

    // Miękki dym
    S.smoke = G.sprite(64, 64, (x) => {
      x.fillStyle = rad(x, 0, 0, 0, 32, [[0, 'rgba(70,70,74,0.75)'], [0.5, 'rgba(60,60,64,0.35)'], [1, 'rgba(50,50,55,0)']]);
      x.fillRect(-32, -32, 64, 64);
    });
    S.smokeLight = G.sprite(64, 64, (x) => {
      x.fillStyle = rad(x, 0, 0, 0, 32, [[0, 'rgba(200,200,205,0.6)'], [0.5, 'rgba(180,180,185,0.25)'], [1, 'rgba(170,170,175,0)']]);
      x.fillRect(-32, -32, 64, 64);
    });
    S.foam = G.sprite(32, 32, (x) => {
      x.fillStyle = rad(x, 0, 0, 0, 16, [[0, 'rgba(255,255,255,0.9)'], [0.6, 'rgba(235,250,255,0.4)'], [1, 'rgba(230,250,255,0)']]);
      x.fillRect(-16, -16, 32, 32);
    });
    S.scorch = G.sprite(80, 80, (x) => {
      const r = G.rng(9);
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU, d = r() * 12, rr = 14 + r() * 16;
        x.fillStyle = rad(x, Math.cos(a) * d, Math.sin(a) * d, 0, rr, [[0, 'rgba(20,14,8,0.55)'], [1, 'rgba(20,14,8,0)']]);
        x.fillRect(-40, -40, 80, 80);
      }
      x.fillStyle = 'rgba(10,8,5,0.6)';
      x.beginPath(); x.arc(0, 0, 7, 0, TAU); x.fill();
    });
    S.star = G.sprite(24, 24, (x) => {
      x.fillStyle = rad(x, 0, 0, 0, 4, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
      x.fillRect(-12, -12, 24, 24);
      x.fillStyle = 'rgba(255,255,255,0.9)';
      x.beginPath(); x.moveTo(0, -12); x.lineTo(1, 0); x.lineTo(0, 12); x.lineTo(-1, 0); x.fill();
      x.beginPath(); x.moveTo(-12, 0); x.lineTo(0, 1); x.lineTo(12, 0); x.lineTo(0, -1); x.fill();
    });
    // Chmury
    S.clouds = [];
    S.cloudShadows = [];
    for (let k = 0; k < 4; k++) {
      const c = G.sprite(360, 240, (x) => {
        const r = G.rng(700 + k * 31);
        const n = 14 + Math.floor(r() * 8);
        for (let i = 0; i < n; i++) {
          const bx = (r() - 0.5) * 220, by = (r() - 0.5) * 110;
          const br = 30 + r() * 50;
          x.fillStyle = rad(x, bx, by, 0, br, [[0, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(245,250,255,0.22)'], [1, 'rgba(240,248,255,0)']], bx - br * 0.2, by - br * 0.3);
          x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill();
        }
      });
      S.clouds.push(c);
      S.cloudShadows.push(G.silhouette(c, '#04121a'));
    }
    // Winieta
    S.vignette = (() => {
      const c = G.makeCanvas(G.W, G.H);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.3, G.W / 2, G.H / 2, G.H * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,8,16,0.55)');
      x.fillStyle = g;
      x.fillRect(0, 0, G.W, G.H);
      const h = x.createLinearGradient(0, 0, 0, 260);
      h.addColorStop(0, 'rgba(170,205,230,0.16)');
      h.addColorStop(1, 'rgba(170,205,230,0)');
      x.fillStyle = h;
      x.fillRect(0, 0, G.W, 260);
      return c;
    })();
    S.damage = (() => {
      const c = G.makeCanvas(G.W, G.H);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.25, G.W / 2, G.H / 2, G.H * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, 'rgba(255,20,10,0.7)');
      x.fillStyle = g;
      x.fillRect(0, 0, G.W, G.H);
      return c;
    })();
  };
})(window.G);
