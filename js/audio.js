'use strict';
// Warstwa dźwiękowa. Efekty i muzyka to próbki wygenerowane w ElevenLabs
// (tools/generate-audio.mjs → js/audio-sfx.js, js/audio-music.js). Gdy próbki
// jeszcze się dekodują albo ich brak, gra używa dawnej syntezy WebAudio.
(function (G) {
  // ---- poziomy (tu najłatwiej dostroić miks) ----
  const MASTER = 0.55;
  const SFX_LEVEL = 0.8;
  const MUSIC_LEVEL = 0.7;      // muzyka tła
  const MUSIC_PAUSED = 0.35;    // muzyka w pauzie
  const JINGLE_LEVEL = 0.8;     // krótkie fanfary
  const XFADE = 3;              // s: płynne łączenie pętli muzyki
  const SWITCH_FADE = 1.5;      // s: zmiana utworu

  // Głośność każdego efektu względem znormalizowanej próbki (szczyt = 0.9).
  const VOL = {
    shoot: 0.30, enemy_shot: 0.26, hit: 0.22, shield: 0.30,
    explosion_small: 0.55, explosion_big: 0.8, splash: 0.30,
    pickup_w: 0.45, pickup_m: 0.45, pickup_r: 0.45, ring: 0.5,
    missile: 0.5, alarm: 0.38, refuel: 0.35, hurt: 0.6, gate: 0.7,
    select: 0.28, confirm: 0.4, extra_life: 0.5, sector_start: 0.42,
    boss_alert: 0.7, respawn: 0.4,
  };

  let ac = null, master, sfx, musicBus, musicDuck, musicFilter, jingleBus, noiseBuf;
  let musicOn = localStorage.getItem('ds_music') !== '0';
  let paused = false;
  let engOsc, engGain, engFilter, engNoise, engNoiseGain;
  let engSrc = null, engLP = null, engSampleGain = null;
  let seqTimer = null, seqStep = 0, seqNext = 0;
  const last = {};
  const buffers = {};   // efekty: nazwa -> { buf, norm }
  const musicBuf = {};  // muzyka: nazwa -> { buf, norm }
  const variants = {};  // 'shoot' -> ['shoot_1', 'shoot_2', ...]
  const lastVariant = {};
  const active = {};    // liczba aktywnych głosów w grupie
  let wanted = null;    // żądany utwór (null = cisza)
  let cur = null;       // grany utwór { name, voices, nextAt }

  const rnd = (a, b) => a + Math.random() * (b - a);

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = MASTER;
    // lekkie ścięcie wysokich tonów, żeby powtarzalne dźwięki nie męczyły
    const shelf = ac.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 7000;
    shelf.gain.value = -3;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(shelf);
    shelf.connect(comp);
    comp.connect(ac.destination);
    sfx = ac.createGain();
    sfx.gain.value = SFX_LEVEL;
    sfx.connect(master);

    // tor muzyki: głosy -> duck -> filtr (pauza) -> poziom
    musicBus = ac.createGain();
    musicBus.connect(master);
    musicFilter = ac.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 20000;
    musicFilter.connect(musicBus);
    musicDuck = ac.createGain();
    musicDuck.connect(musicFilter);
    jingleBus = ac.createGain();
    jingleBus.connect(master);
    updateMusicLevel(true);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Silnik syntezowany (zapasowy): piła + szum przez filtr
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

    loadBank();
    const bank = G.audioBank || {};
    if (!bank.music || !Object.keys(bank.music).length) startSynthMusic();
    setInterval(tickMusic, 250);
  }

  function resume() {
    init();
    if (ac && ac.state === 'suspended' && !document.hidden) ac.resume();
  }

  // Karta w tle nie powinna grać (i nie zbiera opóźnionych zdarzeń).
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else ac.resume();
  });

  // ---- dekodowanie banków ----
  function b64ToBuf(b64) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  function stats(buf) {
    let peak = 0, sum = 0, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.abs(d[i]);
        if (v > peak) peak = v;
        sum += v * v;
        n++;
      }
    }
    return { peak: peak || 1, rms: Math.sqrt(sum / Math.max(1, n)) || 0.1 };
  }

  function register(kind, name, buf) {
    const st = stats(buf);
    if (kind === 'sfx') {
      buffers[name] = { buf, norm: Math.min(4, 0.9 / st.peak) };
      const m = name.match(/^(.*)_(\d+)$/);
      if (m) (variants[m[1]] = variants[m[1]] || []).push(name);
      if (name === 'engine_loop') startEngineSample();
    } else {
      // muzyka: wyrównana głośność (RMS), z ochroną przed przesterowaniem
      const norm = Math.min(3, 0.11 / st.rms, 0.95 / st.peak);
      musicBuf[name] = { buf, norm };
      applyMusic();
    }
  }

  function loadBank() {
    const bank = G.audioBank || {};
    const jobs = [];
    for (const n of Object.keys(bank.sfx || {})) jobs.push(['sfx', n, bank.sfx[n]]);
    const order = ['menu', 'level_a', 'boss', 'level_b', 'victory', 'gameover'];
    const names = Object.keys(bank.music || {}).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    for (const n of names) jobs.push(['music', n, bank.music[n]]);
    (async () => {
      for (const [kind, name, b64] of jobs) {
        try {
          register(kind, name, await ac.decodeAudioData(b64ToBuf(b64)));
        } catch (e) { /* brak próbki = zostaje synteza */ }
      }
    })();
  }

  // ---- odtwarzanie próbek ----
  function panOf(x) {
    if (x === undefined || x === null) return 0;
    return G.clamp((x - G.W / 2) / (G.W / 2), -1, 1) * 0.55;
  }

  function pickVariant(base) {
    const v = variants[base];
    if (!v || !v.length) return base;
    if (v.length === 1) return v[0];
    let n;
    do { n = v[(Math.random() * v.length) | 0]; } while (n === lastVariant[base]);
    lastVariant[base] = n;
    return n;
  }

  // Zwraca true, gdy dźwięk obsłużono (także gdy go pominięto z powodu limitu głosów).
  function play(name, o) {
    const b = buffers[name];
    if (!ac || !b) return false;
    o = o || {};
    if (o.group) {
      if ((active[o.group] || 0) >= (o.cap || 4)) return true;
      active[o.group] = (active[o.group] || 0) + 1;
    }
    const t = ac.currentTime + (o.delay || 0);
    const s = ac.createBufferSource();
    s.buffer = b.buf;
    s.playbackRate.value = o.rate || 1;
    const g = ac.createGain();
    const v = (o.vol === undefined ? 1 : o.vol) * b.norm;
    g.gain.setValueAtTime(v, t);
    s.connect(g);
    let out = g;
    if (o.pan) {
      const p = ac.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      out = p;
    }
    out.connect(o.dest || sfx);
    s.start(t);
    if (o.maxDur) {
      g.gain.setValueAtTime(v, t + o.maxDur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.maxDur);
      s.stop(t + o.maxDur + 0.03);
    }
    s.onended = () => {
      if (o.group) active[o.group]--;
    };
    return true;
  }

  // Chwilowe przyciszenie muzyki pod mocnym dźwiękiem.
  function duck(amount, hold) {
    if (!ac) return;
    const t = ac.currentTime;
    musicDuck.gain.cancelScheduledValues(t);
    musicDuck.gain.setTargetAtTime(1 - amount, t, 0.03);
    musicDuck.gain.setTargetAtTime(1, t + hold, 0.4);
  }

  function updateMusicLevel(instant) {
    if (!ac) return;
    const t = ac.currentTime;
    const m = musicOn ? (paused ? MUSIC_PAUSED : MUSIC_LEVEL) : 0;
    if (instant) musicBus.gain.value = m;
    else musicBus.gain.setTargetAtTime(m, t, 0.12);
    jingleBus.gain.setTargetAtTime(musicOn ? JINGLE_LEVEL : 0, t, 0.05);
    musicFilter.frequency.setTargetAtTime(paused ? 650 : 20000, t, 0.1);
  }

  // ---- muzyka z próbek: pętle łączone płynnie ----
  function curve(up) {
    const n = 48, a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      a[i] = up ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2);
    }
    return a;
  }
  const FADE_IN = curve(true), FADE_OUT = curve(false);

  function spawnVoice(name, when, fadeIn) {
    const b = musicBuf[name];
    const dur = b.buf.duration;
    const s = ac.createBufferSource();
    s.buffer = b.buf;
    const g = ac.createGain();      // obwiednia pętli
    g.gain.value = 0;
    const fin = Math.min(fadeIn, dur / 3);
    const scaled = (arr) => arr.map((x) => x * b.norm);
    g.gain.setValueCurveAtTime(scaled(FADE_IN), when, fin);
    g.gain.setValueCurveAtTime(scaled(FADE_OUT), when + dur - XFADE, XFADE);
    const fade = ac.createGain();   // zewnętrzne wyciszenie przy zmianie utworu
    s.connect(g);
    g.connect(fade);
    fade.connect(musicDuck);
    s.start(when);
    const v = { s, fade };
    s.onended = () => {
      if (cur) cur.voices = cur.voices.filter((x) => x !== v);
    };
    return v;
  }

  function fadeOutVoices(voices, secs) {
    const t = ac.currentTime;
    for (const v of voices) {
      v.fade.gain.cancelScheduledValues(t);
      v.fade.gain.setValueAtTime(v.fade.gain.value, t);
      v.fade.gain.linearRampToValueAtTime(0, t + secs);
      try { v.s.stop(t + secs + 0.05); } catch (e) { /* już zatrzymany */ }
    }
  }

  function applyMusic() {
    if (!ac) return;
    if ((cur && cur.name) === wanted) return;
    if (cur) {
      fadeOutVoices(cur.voices, SWITCH_FADE);
      cur = null;
    }
    if (wanted && musicBuf[wanted]) {
      const t = ac.currentTime + 0.05;
      const v = spawnVoice(wanted, t, SWITCH_FADE);
      cur = { name: wanted, voices: [v], nextAt: t + musicBuf[wanted].buf.duration - XFADE };
    }
  }

  function tickMusic() {
    if (!ac || ac.state !== 'running' || !cur) return;
    // następny przebieg planujemy z wyprzedzeniem, żeby start był co do próbki
    while (cur.nextAt - ac.currentTime < 2.5) {
      cur.voices.push(spawnVoice(cur.name, cur.nextAt, XFADE));
      cur.nextAt += musicBuf[cur.name].buf.duration - XFADE;
    }
  }

  // ---- silnik na próbce ----
  function startEngineSample() {
    if (engSrc || !ac) return;
    const b = buffers.engine_loop;
    engSrc = ac.createBufferSource();
    engSrc.buffer = b.buf;
    engSrc.loop = true;
    engSrc.loopStart = 0.04;                 // omija ciszę kodeka na brzegach
    engSrc.loopEnd = b.buf.duration - 0.04;
    engLP = ac.createBiquadFilter();
    engLP.type = 'lowpass';
    engLP.frequency.value = 1200;
    engSampleGain = ac.createGain();
    engSampleGain.gain.value = 0;
    engSrc.connect(engLP);
    engLP.connect(engSampleGain);
    engSampleGain.connect(sfx);
    engSrc.start(0, 0.04);
    // synteza silnika nie jest już potrzebna
    engGain.gain.value = 0;
    engNoiseGain.gain.value = 0;
  }

  // ---- synteza (zapas) ----
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

  const synth = {
    shoot() {
      tone('square', 1300, 420, 0.05, 0.035);
      noise(0.05, 0.05, 6000, 1500, 'highpass');
    },
    enemyShot() { tone('sawtooth', 520, 180, 0.12, 0.03); },
    hit() { tone('square', 260, 90, 0.06, 0.03); },
    shield() { tone('sine', 1800, 1200, 0.07, 0.03); },
    explosion(big) {
      if (big) {
        noise(1.6, 0.9, 1400, 40);
        tone('sine', 90, 22, 1.3, 0.55);
        noise(0.4, 0.4, 5000, 600, 'highpass');
      } else {
        noise(0.55, 0.45, 2200, 90);
        tone('sine', 140, 35, 0.4, 0.35);
      }
    },
    splash() { noise(0.5, 0.2, 3000, 400, 'bandpass', 0, null, 0.7); },
    pickup() { [660, 880, 1320].forEach((f, i) => tone('triangle', f, f * 1.01, 0.12, 0.09, i * 0.06)); },
    ring() {
      tone('sine', 523, 1046, 0.3, 0.12);
      tone('sine', 784, 1568, 0.3, 0.08, 0.06);
      tone('triangle', 1568, 2093, 0.2, 0.05, 0.12);
    },
    missile() {
      noise(0.5, 0.25, 600, 3500, 'bandpass', 0, null, 1.2);
      tone('sawtooth', 200, 900, 0.3, 0.03);
    },
    alarm() {
      tone('square', 980, 980, 0.1, 0.05);
      tone('square', 740, 740, 0.1, 0.05, 0.13);
    },
    refuel(level) {
      const f = 520 + level * 900;
      tone('sine', f, f * 1.05, 0.06, 0.05);
      tone('triangle', f * 2, f * 2.1, 0.04, 0.02, 0.01);
    },
    hurt() {
      tone('square', 180, 60, 0.18, 0.08);
      noise(0.15, 0.2, 2000, 300);
    },
    gate() {
      tone('sawtooth', 200, 60, 0.9, 0.1);
      noise(0.9, 0.3, 4000, 200, 'bandpass', 0, null, 0.8);
      [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.18, 0.07, 0.2 + i * 0.08));
    },
    select() { tone('triangle', 880, 1100, 0.07, 0.06); },
    confirm() {
      tone('triangle', 660, 1320, 0.15, 0.08);
      tone('sine', 990, 1980, 0.15, 0.05, 0.05);
    },
    extraLife() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone('square', f, f, 0.1, 0.04, i * 0.07)); },
  };

  // ---- API gry ----
  const A = {
    resume,
    get musicOn() { return musicOn; },
    get track() { return cur ? cur.name : null; },
    toggleMusic() {
      musicOn = !musicOn;
      localStorage.setItem('ds_music', musicOn ? '1' : '0');
      updateMusicLevel(false);
    },
    // Żądany utwór: 'menu' | 'level_a' | 'level_b' | 'boss' | null (cisza).
    setMusic(name) {
      name = name || null;
      if (name === wanted) return;
      wanted = name;
      applyMusic();
    },
    setPaused(p) {
      if (p === paused) return;
      paused = p;
      updateMusicLevel(false);
    },
    // Krótkie fanfary ('victory', 'gameover'), niezależne od pętli muzyki.
    jingle(name) {
      if (!ac || !musicBuf[name]) return;
      const b = musicBuf[name];
      const s = ac.createBufferSource();
      s.buffer = b.buf;
      const g = ac.createGain();
      g.gain.value = b.norm;
      s.connect(g);
      g.connect(jingleBus);
      s.start(ac.currentTime + 0.35);
    },
    shoot(x) {
      if (!ac || !limit('shoot', 60)) return;
      if (!play(pickVariant('shoot'), { vol: VOL.shoot, rate: rnd(0.94, 1.08), maxDur: 0.22, group: 'shoot', cap: 4, pan: panOf(x) * 0.5 })) synth.shoot();
    },
    enemyShot(x) {
      if (!ac || !limit('eshot', 70)) return;
      if (!play(pickVariant('enemy_shot'), { vol: VOL.enemy_shot, rate: rnd(0.92, 1.08), maxDur: 0.4, group: 'eshot', cap: 4, pan: panOf(x) })) synth.enemyShot();
    },
    hit(x) {
      if (!ac || !limit('hit', 45)) return;
      if (!play(pickVariant('hit'), { vol: VOL.hit, rate: rnd(0.9, 1.12), maxDur: 0.25, group: 'hit', cap: 3, pan: panOf(x) })) synth.hit();
    },
    shield() {
      if (!ac || !limit('shield', 80)) return;
      if (!play('shield', { vol: VOL.shield, rate: rnd(0.95, 1.1), maxDur: 0.4, group: 'shield', cap: 2 })) synth.shield();
    },
    explosion(big, x) {
      if (!ac || !limit('expl', 45)) return;
      const ok = big
        ? play(pickVariant('explosion_big'), { vol: VOL.explosion_big, rate: rnd(0.94, 1.04), group: 'explB', cap: 2, pan: panOf(x) })
        : play(pickVariant('explosion_small'), { vol: VOL.explosion_small, rate: rnd(0.9, 1.1), group: 'explS', cap: 5, pan: panOf(x) });
      if (!ok) synth.explosion(big);
      if (big) duck(0.4, 0.5);
    },
    splash(x) {
      if (!ac || !limit('splash', 90)) return;
      if (!play('splash', { vol: VOL.splash, rate: rnd(0.9, 1.15), group: 'splash', cap: 3, pan: panOf(x) })) synth.splash();
    },
    pickup(type) {
      if (!ac) return;
      const n = type === 'M' ? 'pickup_m' : type === 'R' ? 'pickup_r' : 'pickup_w';
      if (!play(n, { vol: VOL[n] })) synth.pickup();
    },
    ring() {
      if (!ac) return;
      if (!play('ring', { vol: VOL.ring })) synth.ring();
    },
    missile() {
      if (!ac) return;
      if (!play('missile', { vol: VOL.missile, rate: rnd(0.95, 1.05), group: 'missile', cap: 3 })) synth.missile();
    },
    alarm() {
      if (!ac || !limit('alarm', 500)) return;
      if (!play('alarm', { vol: VOL.alarm, maxDur: 0.7 })) synth.alarm();
    },
    // Tankowanie: szybkie "tyk-tyk" z tonem rosnącym razem z poziomem energii.
    refuel(level) {
      if (!ac || !limit('refuel', 85)) return;
      if (!play('refuel', { vol: VOL.refuel, rate: 0.8 + level * 0.9, maxDur: 0.16, group: 'refuel', cap: 3 })) synth.refuel(level);
    },
    hurt() {
      if (!ac || !limit('hurt', 90)) return;
      if (!play('hurt', { vol: VOL.hurt, rate: rnd(0.95, 1.05), group: 'hurt', cap: 2 })) synth.hurt();
    },
    gate() {
      if (!ac) return;
      if (!play('gate', { vol: VOL.gate })) synth.gate();
      else duck(0.4, 1.2);
    },
    select() {
      if (!ac) return;
      if (!play('select', { vol: VOL.select, rate: rnd(0.97, 1.05), maxDur: 0.25 })) synth.select();
    },
    confirm() {
      if (!ac) return;
      if (!play('confirm', { vol: VOL.confirm, maxDur: 0.4 })) synth.confirm();
    },
    extraLife() {
      if (!ac) return;
      if (!play('extra_life', { vol: VOL.extra_life })) synth.extraLife();
    },
    sectorStart() {
      if (!ac) return;
      play('sector_start', { vol: VOL.sector_start });
    },
    bossAlert() {
      if (!ac) return;
      if (!play('boss_alert', { vol: VOL.boss_alert })) synth.alarm();
      else duck(0.5, 1.8);
    },
    respawn() {
      if (!ac) return;
      play('respawn', { vol: VOL.respawn });
    },
    victory() { A.jingle('victory'); },
    gameOver() { A.jingle('gameover'); },
    engine(on, speedK) {
      if (!ac) return;
      const t = ac.currentTime;
      if (engSampleGain) {
        engSampleGain.gain.setTargetAtTime(on ? 0.1 + speedK * 0.1 : 0, t, 0.25);
        engSrc.playbackRate.setTargetAtTime(0.85 + speedK * 0.45, t, 0.3);
        engLP.frequency.setTargetAtTime(900 + speedK * 3500, t, 0.3);
        return;
      }
      engGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.2);
      engNoiseGain.gain.setTargetAtTime(on ? 0.035 + speedK * 0.04 : 0, t, 0.2);
      engOsc.frequency.setTargetAtTime(46 + speedK * 30, t, 0.3);
      engFilter.frequency.setTargetAtTime(220 + speedK * 500, t, 0.3);
    },
  };

  // ----- Muzyka zapasowa (gdy brak banku muzyki): krótki sekwencer -----
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
      tone('sawtooth', bassSeq[bar][s], bassSeq[bar][s] * 0.99, STEP * 0.9, 0.16, dly, synthOut);
      if (s % 2 === 0) tone('sine', 130, 38, 0.18, 0.5, dly, synthOut);
      else noise(0.05, 0.12, 9000, 6000, 'highpass', dly, synthOut);
      if (s === 4) noise(0.18, 0.22, 2500, 700, 'bandpass', dly, synthOut, 0.8);
      const ch = chords[bar];
      const f = ch[(seqStep * 2) % 3] * (seqStep % 16 < 8 ? 1 : 2);
      tone('triangle', f, f, STEP * 0.45, 0.045, dly, synthOut);
      tone('triangle', ch[(seqStep * 2 + 1) % 3] * 2, ch[(seqStep * 2 + 1) % 3] * 2, STEP * 0.4, 0.03, dly + STEP / 2, synthOut);
      seqNext += STEP;
      seqStep++;
    }
  }

  let synthOut = null;
  function startSynthMusic() {
    if (seqTimer) return;
    synthOut = ac.createGain();
    synthOut.gain.value = 0.32;
    synthOut.connect(musicDuck);
    seqNext = ac.currentTime + 0.1;
    seqTimer = setInterval(schedule, 40);
  }

  G.audio = A;
})(window.G);
