'use strict';
// Post-processing: tani bloom (progowanie przez potęgowanie jasności) i korekcja barwna sektorów.
(function (G) {
  const W = G.W, H = G.H;
  const BW = 160, BH = 240;
  let a = null, ax, b, bx;
  let filterOk = true;

  function init() {
    a = G.makeCanvas(BW, BH);
    ax = a.getContext('2d');
    b = G.makeCanvas(BW, BH);
    bx = b.getContext('2d');
    filterOk = 'filter' in bx;
  }

  const rgba = (c, k) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, c[3] * (k === undefined ? 1 : k))})`;

  G.Post = {
    enabled: true,
    // Jasne elementy (ogień, pociski, pierścienie, błyski) dostają miękką poświatę.
    bloom(ctx, src, amount) {
      if (!this.enabled || amount <= 0) return;
      if (!a) init();
      ax.globalCompositeOperation = 'copy';
      ax.globalAlpha = 1;
      ax.imageSmoothingEnabled = true;
      ax.drawImage(src, 0, 0, src.width, src.height, 0, 0, BW, BH);
      // x^16: ciemne i średnie tony znikają, zostają tylko najjaśniejsze piksele
      ax.globalCompositeOperation = 'multiply';
      for (let i = 0; i < 4; i++) ax.drawImage(a, 0, 0);
      bx.globalCompositeOperation = 'copy';
      if (filterOk) bx.filter = 'blur(3px)';
      bx.drawImage(a, 0, 0);
      if (filterOk) bx.filter = 'none';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = amount;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(b, 0, 0, W, H);
      ctx.globalAlpha = amount * 0.6;
      ctx.drawImage(a, 0, 0, W, H);
      ctx.restore();
    },

    // L: wygląd sektora (patrz G.LOOKS), już zmieszany między sektorami.
    grade(ctx, L) {
      if (!L) return;
      ctx.save();
      if (L.sl[3] > 0.005) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = rgba(L.sl);
        ctx.fillRect(0, 0, W, H);
      }
      if (L.sun[3] > 0.005) {
        ctx.globalCompositeOperation = 'screen';
        const g = ctx.createRadialGradient(-80, -140, 0, -80, -140, H * 1.15);
        g.addColorStop(0, rgba(L.sun));
        g.addColorStop(0.55, rgba(L.sun, 0.35));
        g.addColorStop(1, rgba(L.sun, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (L.top[3] > 0.005) {
        const g = ctx.createLinearGradient(0, 0, 0, H * 0.5);
        g.addColorStop(0, rgba(L.top));
        g.addColorStop(1, rgba(L.top, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H * 0.5);
      }
      if (L.bot[3] > 0.005) {
        const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
        g.addColorStop(0, rgba(L.bot, 0));
        g.addColorStop(1, rgba(L.bot));
        ctx.fillStyle = g;
        ctx.fillRect(0, H * 0.55, W, H * 0.45);
      }
      if (L.fog > 0.005) {
        ctx.fillStyle = `rgba(${L.top[0] | 0},${L.top[1] | 0},${L.top[2] | 0},${L.fog})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    },
  };
})(window.G);
