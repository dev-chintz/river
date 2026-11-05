'use strict';
// Dźwięk syntezowany w WebAudio: efekty, silnik, prosta muzyka.
(function (G) {
  let ac = null, master, sfx, music, noiseBuf;
  let musicOn = localStorage.getItem('ds_music') !== '0';
  let engOsc, engGain, engFilter, engNoise, engNoiseGain;
  let seqTimer = null, seqStep = 0, seqNext = 0;
  const last = {};

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.55;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ac.destination);
    sfx = ac.createGain();
    sfx.gain.value = 0.8;
    sfx.connect(master);
    music = ac.createGain();
    music.gain.value = musicOn ? 0.22 : 0;
    music.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Silnik: piła + szum przez filtr
    engOsc = ac.createOscillator();
    engOsc.type = 'sawtooth';
    engOsc.frequency.value = 52;
    engFilter = ac.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 300;
    engGain = ac.createGain();
    engGain.gain.value = 0;
    engOsc.connect(engFilter);
    engFilter.connect(engGain);
    engGain.connect(sfx);
    engOsc.start();
    engNoise = ac.createBufferSource();
    engNoise.buffer = noiseBuf;
    engNoise.loop = true;
    const nf = ac.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 900;
    nf.Q.value = 0.6;
    engNoiseGain = ac.createGain();
    engNoiseGain.gain.value = 0;
    engNoise.connect(nf);
    nf.connect(engNoiseGain);
    engNoiseGain.connect(sfx);
    engNoise.start();
    startMusic();
  }

  function resume() {
    init();
    if (ac && ac.state === 'suspended') ac.resume();
  }

  function limit(name, gap) {
    const now = performance.now();
    if (last[name] && now - last[name] < gap) return false;
    last[name] = now;
    return true;
  }

  function tone(type, f0, f1, dur, vol, delay, dest) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || sfx);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, f0, f1, type, delay, dest, q) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (q) f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || sfx);
    s.start(t, Math.random() * 1.2);
    s.stop(t + dur + 0.05);
  }

  const A = {
    resume,
    get musicOn() { return musicOn; },
    toggleMusic() {
      musicOn = !musicOn;
      localStorage.setItem('ds_music', musicOn ? '1' : '0');
      if (music) music.gain.setTargetAtTime(musicOn ? 0.22 : 0, ac.currentTime, 0.1);
    },
    shoot() {
      if (!ac || !limit('shoot', 55)) return;
      tone('square', 1300, 420, 0.05, 0.035);
      noise(0.05, 0.05, 6000, 1500, 'highpass');
    },
    enemyShot() {
      if (!ac || !limit('eshot', 70)) return;
      tone('sawtooth', 520, 180, 0.12, 0.03);
    },
    hit() {
      if (!ac || !limit('hit', 40)) return;
      tone('square', 260, 90, 0.06, 0.03);
    },
    shield() {
      if (!ac || !limit('shield', 70)) return;
      tone('sine', 1800, 1200, 0.07, 0.03);
    },
    explosion(big) {
      if (!ac || !limit('expl', 45)) return;
      if (big) {
        noise(1.6, 0.9, 1400, 40);
        tone('sine', 90, 22, 1.3, 0.55);
        noise(0.4, 0.4, 5000, 600, 'highpass');
      } else {
        noise(0.55, 0.45, 2200, 90);
        tone('sine', 140, 35, 0.4, 0.35);
      }
    },
    splash() {
      if (!ac || !limit('splash', 80)) return;
      noise(0.5, 0.2, 3000, 400, 'bandpass', 0, null, 0.7);
    },
    pickup() {
      if (!ac) return;
      [660, 880, 1320].forEach((f, i) => tone('triangle', f, f * 1.01, 0.12, 0.09, i * 0.06));
    },
    ring() {
      if (!ac) return;
      tone('sine', 523, 1046, 0.3, 0.12);
      tone('sine', 784, 1568, 0.3, 0.08, 0.06);
      tone('triangle', 1568, 2093, 0.2, 0.05, 0.12);
    },
    missile() {
      if (!ac) return;
      noise(0.5, 0.25, 600, 3500, 'bandpass', 0, null, 1.2);
      tone('sawtooth', 200, 900, 0.3, 0.03);
    },
    alarm() {
      if (!ac || !limit('alarm', 500)) return;
      tone('square', 980, 980, 0.1, 0.05);
      tone('square', 740, 740, 0.1, 0.05, 0.13);
    },
    scrape() {
      if (!ac || !limit('scrape', 120)) return;
      noise(0.15, 0.25, 900, 300, 'bandpass', 0, null, 2);
    },
    hurt() {
      if (!ac || !limit('hurt', 90)) return;
      tone('square', 180, 60, 0.18, 0.08);
      noise(0.15, 0.2, 2000, 300);
    },
    gate() {
      if (!ac) return;
      tone('sawtooth', 200, 60, 0.9, 0.1);
      noise(0.9, 0.3, 4000, 200, 'bandpass', 0, null, 0.8);
      [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.18, 0.07, 0.2 + i * 0.08));
    },
    select() {
      if (!ac) return;
      tone('triangle', 880, 1100, 0.07, 0.06);
    },
    confirm() {
      if (!ac) return;
      tone('triangle', 660, 1320, 0.15, 0.08);
      tone('sine', 990, 1980, 0.15, 0.05, 0.05);
    },
    extraLife() {
      if (!ac) return;
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone('square', f, f, 0.1, 0.04, i * 0.07));
    },
    engine(on, speedK) {
      if (!ac) return;
      const t = ac.currentTime;
      engGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.2);
      engNoiseGain.gain.setTargetAtTime(on ? 0.035 + speedK * 0.04 : 0, t, 0.2);
      engOsc.frequency.setTargetAtTime(46 + speedK * 30, t, 0.3);
      engFilter.frequency.setTargetAtTime(220 + speedK * 500, t, 0.3);
    },
  };

  // ----- Muzyka: krótki sekwencer -----
  const bassSeq = [
    [55, 55, 110, 55, 55, 110, 55, 82.4],
    [43.65, 43.65, 87.3, 43.65, 43.65, 87.3, 43.65, 65.4],
    [65.4, 65.4, 130.8, 65.4, 65.4, 130.8, 65.4, 98],
    [49, 49, 98, 49, 49, 98, 61.7, 73.4],
  ];
  const chords = [
    [440, 523.3, 659.3],
    [349.2, 440, 523.3],
    [392, 523.3, 659.3],
    [392, 493.9, 587.3],
  ];
  const STEP = 60 / 118 / 2; // ósemki

  function schedule() {
    if (!ac) return;
    while (seqNext < ac.currentTime + 0.15) {
      const bar = Math.floor(seqStep / 8) % 4;
      const s = seqStep % 8;
      const t = seqNext;
      const dly = t - ac.currentTime;
      // bas
      tone('sawtooth', bassSeq[bar][s], bassSeq[bar][s] * 0.99, STEP * 0.9, 0.16, dly, music);
      // stopa i hi-hat
      if (s % 2 === 0) tone('sine', 130, 38, 0.18, 0.5, dly, music);
      else noise(0.05, 0.12, 9000, 6000, 'highpass', dly, music);
      if (s === 4) noise(0.18, 0.22, 2500, 700, 'bandpass', dly, music, 0.8);
      // arpeggio
      const ch = chords[bar];
      const f = ch[(seqStep * 2) % 3] * (seqStep % 16 < 8 ? 1 : 2);
      tone('triangle', f, f, STEP * 0.45, 0.045, dly, music);
      tone('triangle', ch[(seqStep * 2 + 1) % 3] * 2, ch[(seqStep * 2 + 1) % 3] * 2, STEP * 0.4, 0.03, dly + STEP / 2, music);
      seqNext += STEP;
      seqStep++;
    }
  }

  function startMusic() {
    if (seqTimer) return;
    seqNext = ac.currentTime + 0.1;
    seqTimer = setInterval(schedule, 40);
  }

  G.audio = A;
})(window.G);
