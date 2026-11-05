'use strict';
// Klawiatura, gamepad, dotyk i mysz.
(function (G) {
  const keys = {}, pressed = {};
  const MAP = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    fire: ['Space', 'KeyJ', 'KeyZ'],
    missile: ['KeyX', 'KeyK', 'ShiftLeft', 'ShiftRight'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'Space', 'NumpadEnter'],
    back: ['Escape', 'Backspace'],
    music: ['KeyM'],
  };
  // gamepad: przyciski -> akcje
  const PADMAP = {
    fire: [0, 7],
    missile: [2, 6, 5],
    confirm: [0, 9],
    back: [1],
    pause: [9],
    up: [12],
    down: [13],
    left: [14],
    right: [15],
  };
  let padPrev = {}, padNow = {}, padAxisX = 0, padAxisY = 0;

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    G.audio.resume();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });

  const I = {
    touch: { active: false, x: 0, y: 0, start: 0 },
    pointer: { x: -1, y: -1, clicked: false, moved: false },
    lastDevice: 'kb',
    down(action) {
      const m = MAP[action];
      if (m) for (const k of m) if (keys[k]) return true;
      const p = PADMAP[action];
      if (p) for (const b of p) if (padNow[b]) return true;
      return false;
    },
    hit(action) {
      const m = MAP[action];
      if (m) for (const k of m) if (pressed[k]) return true;
      const p = PADMAP[action];
      if (p) for (const b of p) if (padNow[b] && !padPrev[b]) return true;
      return false;
    },
    axisX() {
      let v = 0;
      if (I.down('left')) v -= 1;
      if (I.down('right')) v += 1;
      if (Math.abs(padAxisX) > 0.18) v = padAxisX;
      return G.clamp(v, -1, 1);
    },
    axisY() {
      let v = 0;
      if (I.down('up')) v += 1;
      if (I.down('down')) v -= 1;
      if (Math.abs(padAxisY) > 0.3) v = -padAxisY;
      return G.clamp(v, -1, 1);
    },
    menuUp() {
      return I.hit('up') || (padAxisY < -0.6 && !I._padYLatch && (I._padYLatch = true));
    },
    menuDown() {
      return I.hit('down') || (padAxisY > 0.6 && !I._padYLatch && (I._padYLatch = true));
    },
    poll() {
      padPrev = padNow;
      padNow = {};
      padAxisX = 0;
      padAxisY = 0;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of pads) {
        if (!gp) continue;
        gp.buttons.forEach((b, i) => {
          if (b.pressed) {
            padNow[i] = true;
            I.lastDevice = 'pad';
          }
        });
        if (gp.axes.length > 1) {
          padAxisX = gp.axes[0];
          padAxisY = gp.axes[1];
        }
        break;
      }
      if (Math.abs(padAxisY) < 0.4) I._padYLatch = false;
    },
    endFrame() {
      for (const k in pressed) delete pressed[k];
      I.pointer.clicked = false;
    },
    attach(canvas) {
      const toGame = (cx, cy) => {
        const r = canvas.getBoundingClientRect();
        return [((cx - r.left) / r.width) * G.W, ((cy - r.top) / r.height) * G.H];
      };
      canvas.addEventListener('mousemove', (e) => {
        const [x, y] = toGame(e.clientX, e.clientY);
        I.pointer.x = x;
        I.pointer.y = y;
        I.pointer.moved = true;
      });
      canvas.addEventListener('mousedown', (e) => {
        const [x, y] = toGame(e.clientX, e.clientY);
        I.pointer.x = x;
        I.pointer.y = y;
        I.pointer.clicked = true;
        G.audio.resume();
      });
      const tstart = (e) => {
        e.preventDefault();
        G.audio.resume();
        const t = e.changedTouches[0];
        const [x, y] = toGame(t.clientX, t.clientY);
        I.touch.active = true;
        I.touch.x = x;
        I.touch.y = y;
        I.touch.count = e.touches.length;
        I.pointer.x = x;
        I.pointer.y = y;
        I.pointer.clicked = true;
        I.lastDevice = 'touch';
        if (e.touches.length >= 2) pressed['KeyX'] = true;
      };
      const tmove = (e) => {
        e.preventDefault();
        const t = e.touches[0];
        if (!t) return;
        const [x, y] = toGame(t.clientX, t.clientY);
        I.touch.x = x;
        I.touch.y = y;
      };
      const tend = (e) => {
        e.preventDefault();
        if (e.touches.length === 0) I.touch.active = false;
      };
      canvas.addEventListener('touchstart', tstart, { passive: false });
      canvas.addEventListener('touchmove', tmove, { passive: false });
      canvas.addEventListener('touchend', tend, { passive: false });
      canvas.addEventListener('touchcancel', tend, { passive: false });
    },
  };
  G.Input = I;
})(window.G);
