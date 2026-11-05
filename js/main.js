'use strict';
// Pętla główna, maszyna stanów, skalowanie ekranu.
(function (G) {
  const W = G.W, H = G.H;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let scale = 1;

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const k = Math.min(vw / W, vh / H);
    const cw = Math.floor(W * k), ch = Math.floor(H * k);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const dpr = window.devicePixelRatio || 1;
    scale = G.clamp((ch * dpr) / H, 1, 2);
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    G.renderScale = canvas.height / H;
    // rozdzielczość kafli terenu dopasowana do ekranu (nowe kafle po zmianie rozmiaru)
    G.terrainScale = Math.min(2, Math.max(1, Math.round(G.renderScale * 2) / 2));
  }
  window.addEventListener('resize', resize);
  resize();
  G.canvas = canvas;

  G.initSprites();
  G.Input.attach(canvas);

  const S = {
    state: 'menu',
    sel: 0,
    psel: 0,
    t: 0,
    rects: [],
    attract: new G.Game('attract'),
    game: null,
    results: null,
    resT: 0,
  };
  G.state = S;

  function startGame(mode) {
    S.game = new G.Game(mode);
    S.state = 'play';
    S.lastMode = mode;
    G.audio.confirm();
  }

  function finishGame() {
    const g = S.game;
    const info = g.mode === 'time' ? `sektor ${g.sectorIdx + 1}` : g.won ? 'ukończona' : `sektor ${g.sectorIdx + 1}`;
    const rank = G.Scores.add(g.mode, { s: Math.floor(g.score), info, d: Date.now() });
    S.results = {
      mode: g.mode, won: g.won, score: Math.floor(g.score), rank,
      sector: g.sectorIdx + (g.won && g.mode === 'campaign' ? 0 : 1),
      kills: g.stats.kills, rings: g.stats.rings, gates: g.stats.gates,
    };
    S.state = 'results';
    S.resT = 0;
    G.audio.engine(false, 0);
  }

  function pointerMenu(rects, onSel, onConfirm) {
    const P = G.Input.pointer;
    for (const r of rects) {
      const inside = P.x >= r.x && P.x <= r.x + r.w && P.y >= r.y && P.y <= r.y + r.h;
      if (inside && P.moved) onSel(r.i);
      if (inside && P.clicked) {
        onSel(r.i);
        onConfirm();
        return;
      }
    }
    P.moved = false;
  }

  function update(dt) {
    const I = G.Input;
    S.t += dt;
    if (I.hit('music')) G.audio.toggleMusic();

    if (S.state === 'menu') {
      S.attract.update(dt);
      const n = G.UI.MENU.length;
      if (I.menuUp()) { S.sel = (S.sel + n - 1) % n; G.audio.select(); }
      if (I.menuDown()) { S.sel = (S.sel + 1) % n; G.audio.select(); }
      const go = () => {
        const id = G.UI.MENU[S.sel].id;
        if (id === 'controls' || id === 'scores') { S.state = id; G.audio.select(); }
        else startGame(id);
      };
      if (I.hit('confirm')) go();
      else pointerMenu(S.rects, (i) => { if (i !== S.sel) { S.sel = i; G.audio.select(); } }, go);
    } else if (S.state === 'controls' || S.state === 'scores') {
      S.attract.update(dt);
      if (I.hit('back') || I.hit('confirm') || I.pointer.clicked) { S.state = 'menu'; G.audio.select(); }
    } else if (S.state === 'play') {
      if (I.hit('pause') || (document.hidden && !S.game.finished)) {
        S.state = 'pause';
        S.psel = 0;
        G.audio.engine(false, 0);
        return;
      }
      S.game.update(dt);
      if (S.game.done) finishGame();
    } else if (S.state === 'pause') {
      const n = 3;
      if (I.menuUp()) { S.psel = (S.psel + n - 1) % n; G.audio.select(); }
      if (I.menuDown()) { S.psel = (S.psel + 1) % n; G.audio.select(); }
      const go = () => {
        if (S.psel === 0) S.state = 'play';
        else if (S.psel === 1) startGame(S.game.mode);
        else { S.state = 'menu'; S.game = null; }
        G.audio.select();
      };
      if (I.hit('pause') && !I.hit('confirm')) { S.state = 'play'; }
      else if (I.hit('confirm')) go();
      else pointerMenu(S.rects, (i) => { S.psel = i; }, go);
    } else if (S.state === 'results') {
      S.resT += dt;
      S.game.update(dt);
      if (S.resT > 1) {
        if (I.hit('confirm') || I.pointer.clicked) startGame(S.results.mode);
        else if (I.hit('back')) { S.state = 'menu'; S.game = null; G.audio.select(); }
      }
    }
  }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (S.state === 'menu' || S.state === 'controls' || S.state === 'scores') {
      S.attract.draw(ctx);
      if (S.state === 'menu') G.UI.drawMenu(ctx, S.sel, S.t, S.rects);
      else if (S.state === 'controls') G.UI.drawControls(ctx, S.t);
      else G.UI.drawScores(ctx);
    } else if (S.game) {
      S.game.draw(ctx);
      if (S.state !== 'results') G.UI.drawHUD(ctx, S.game);
      if (S.state === 'pause') G.UI.drawPause(ctx, S.psel, S.rects);
      if (S.state === 'results') G.UI.drawResults(ctx, S.results, S.resT);
    }
  }

  // Jedna aktualizacja na klatkę ekranu (płynnie także przy 120/144 Hz);
  // długie klatki dzielone na kroki nie dłuższe niż 1/60 s.
  const MAXSTEP = 1 / 60;
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt > 0) {
      const n = Math.max(1, Math.ceil(dt / MAXSTEP - 0.05));
      G.Input.poll();
      for (let i = 0; i < n; i++) {
        update(dt / n);
        if (i === 0) G.Input.endFrame();
      }
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(window.G);
