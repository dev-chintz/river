// Generator dźwięków dla Delta Strike (ElevenLabs).
//
// Użycie (z głównego folderu projektu, klucz w .env jako ELEVENLABS_API_KEY):
//   node tools/generate-audio.mjs                 generuje brakujące pliki (SFX + muzyka)
//   node tools/generate-audio.mjs --sfx           tylko efekty
//   node tools/generate-audio.mjs --music         tylko muzyka
//   node tools/generate-audio.mjs --only=shoot_1,boss   tylko wskazane nazwy
//   node tools/generate-audio.mjs --force         nadpisuje istniejące pliki
//   node tools/generate-audio.mjs --bank          nie wywołuje API, tylko przebudowuje js/audio-*.js
//
// Wynik: audio/sfx/*.mp3, audio/music/*.mp3 oraz js/audio-sfx.js i js/audio-music.js
// (pliki zakodowane base64, dzięki czemu gra działa także po otwarciu index.html z dysku).
// Istniejące pliki nie są generowane ponownie, więc kredyty nie przepadają przy powtórkach.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.elevenlabs.io/v1';

// ---------------------------------------------------------------- manifest
// Opisy po angielsku, bo model dźwięku najlepiej je rozumie.
const SFX_STYLE = 'clean isolated video game sound effect, no music, no voice';

const SFX = [
  // strzały gracza: trzy warianty, żeby seria nie brzmiała jak zapętlony sampel
  ['shoot_1', 'soft sci-fi pulse cannon shot from a small fighter jet, very short, punchy, gentle high end', 0.5],
  ['shoot_2', 'light laser blaster pew, short, rounded and smooth, slightly lower pitch', 0.5],
  ['shoot_3', 'compact energy bolt zap, short, soft attack, airy tail', 0.5],
  ['enemy_shot_1', 'enemy plasma bolt whoosh, low and muffled, short', 0.5],
  ['enemy_shot_2', 'dull energy spit from a gun turret, short, soft, bassy', 0.5],
  ['hit_1', 'small bullet impact on armored metal, light tick, very short', 0.5],
  ['hit_2', 'tiny metallic ping of a projectile hitting a hull, short, dry', 0.5],
  ['hit_3', 'quick light thud on metal plating, short', 0.5],
  ['shield', 'energy shield deflecting a shot, soft glassy ping, short', 0.5],
  ['explosion_small_1', 'small explosion of a boat, punchy boom with short debris, not too loud', 1.2],
  ['explosion_small_2', 'compact fiery blast with a low thump and quick crackle, short', 1.2],
  ['explosion_small_3', 'drone destroyed, soft pop and burst of sparks, short boom', 1.0],
  ['explosion_big_1', 'large cinematic explosion with deep rumble and long tail, powerful but smooth, not harsh', 2.5],
  ['explosion_big_2', 'big heavy blast, deep sub boom, crackling debris falling, rounded and not piercing', 2.5],
  ['splash', 'small quick water splash, light, short', 0.8],
  ['pickup_w', 'bright pleasant power-up chime, two notes ascending, weapon upgrade, short', 0.8],
  ['pickup_m', 'satisfying ammo pickup, soft mechanical click followed by a gentle chime, short', 0.8],
  ['pickup_r', 'warm healing repair sound, gentle ascending shimmer, short', 0.9],
  ['ring', 'magical energy ring collected, airy shimmering chime, glassy and sweet', 1.0],
  ['missile', 'missile launch, short rocket ignition whoosh, smooth, not too loud', 1.0],
  ['alarm', 'gentle low-urgency double beep warning, soft electronic tone, short', 0.7],
  ['refuel', 'single soft electronic tick, clean and short, tiny click with a pure tone', 0.5],
  ['hurt', 'heavy impact on an armored hull, metallic thud with a short crunch, medium', 0.8],
  ['gate', 'massive energy force field gate shutting down, deep power-down sweep followed by a triumphant shimmering chord', 2.8],
  ['select', 'subtle futuristic UI menu tick, soft and short', 0.5],
  ['confirm', 'sci-fi UI confirm, soft positive chirp, rising, short', 0.5],
  ['extra_life', 'cheerful uplifting 1-up jingle, short, bright synth notes, friendly', 1.6],
  ['sector_start', 'airy cinematic whoosh with a soft rising swell, signaling a new level, short', 2.0],
  ['boss_alert', 'ominous low warning swell with deep pulsing horn, big enemy approaching, tense but smooth', 3.0],
  ['respawn', 'soft energy shield powering up, rising hum with a gentle shimmer', 1.2],
  // pętla silnika (loop: true w API)
  ['engine_loop', 'steady smooth jet engine hum, low rumble with soft air rush, constant and even, no sudden changes', 4.0, { loop: true }],
];

const MUSIC_STYLE = 'instrumental, no vocals, smooth, not harsh or fatiguing, mixed to sit softly behind sound effects';

// [nazwa, prompt, długość w sekundach]
const MUSIC = [
  ['menu', 'Atmospheric hopeful synthwave instrumental at about 100 BPM for the title screen of a modern arcade river shooter. Warm analog pads, soft pulsing bass, gentle arpeggio, light drums. Calm, inviting and spacious.', 60],
  ['level_a', 'Mid-tempo (about 112 BPM) driving electronic instrumental for a vertical scrolling shoot-em-up flying over a bright river at daytime. Rolling bassline, warm arpeggios, soft four-on-the-floor kick, light hi-hats, a catchy but unobtrusive melodic lead. Steady energy, no sudden drops, optimistic and relaxed.', 90],
  ['level_b', 'Slightly darker and more intense electronic instrumental (about 118 BPM) for a shoot-em-up flying over a river at dusk. Minor key, pulsing bass, tight but soft drums, evolving synth arpeggios, a restrained melodic lead. Atmospheric and driving without being aggressive, steady energy.', 90],
  ['boss', 'Tense but controlled boss battle music at about 128 BPM for a shoot-em-up. Heavy pulsing bass, tight drums, dramatic synth stabs and rising pads, dark minor key. Powerful and exciting but polished and not noisy.', 75],
  ['victory', 'Short triumphant victory fanfare, about 8 seconds, uplifting synths and warm brass-like chords, ends on a clearly resolved final chord.', 8],
  ['gameover', 'Short gentle game over jingle, about 6 seconds, descending soft synth notes, melancholic but not depressing, resolves quietly.', 6],
];

// ---------------------------------------------------------------- narzędzia
function loadKey() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) throw new Error('Brak pliku .env');
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.*?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  throw new Error('W .env brak ELEVENLABS_API_KEY');
}

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const wantSfx = flag('sfx') || !flag('music');
const wantMusic = flag('music') || !flag('sfx');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, key, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.detail?.message || JSON.stringify(j.detail || j);
    } catch { /* zostaw surowy tekst */ }
    throw new Error(`HTTP ${res.status}: ${msg.slice(0, 300)}`);
  }
}

function outFile(kind, name) {
  const dir = path.join(ROOT, 'audio', kind);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name + '.mp3');
}

const selected = (name) => !only.length || only.includes(name);

async function genSfx(key) {
  for (const [name, text, dur, extra] of SFX) {
    if (!selected(name)) continue;
    const file = outFile('sfx', name);
    if (fs.existsSync(file) && !flag('force')) { console.log('= ' + name + ' (jest)'); continue; }
    try {
      const buf = await post(`${API}/sound-generation?output_format=mp3_44100_128`, key, {
        text: `${text}, ${SFX_STYLE}`,
        duration_seconds: dur,
        prompt_influence: 0.6,
        ...(extra || {}),
      });
      fs.writeFileSync(file, buf);
      console.log(`+ ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`! ${name}: ${e.message}`);
    }
  }
}

async function genMusic(key) {
  for (const [name, prompt, sec] of MUSIC) {
    if (!selected(name)) continue;
    const file = outFile('music', name);
    if (fs.existsSync(file) && !flag('force')) { console.log('= music ' + name + ' (jest)'); continue; }
    try {
      const buf = await post(`${API}/music?output_format=mp3_44100_64`, key, {
        prompt: `${prompt} ${MUSIC_STYLE}.`,
        music_length_ms: sec * 1000,
        force_instrumental: true,
      });
      fs.writeFileSync(file, buf);
      console.log(`+ music ${name} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`! music ${name}: ${e.message}`);
      if (/40[123]/.test(e.message)) { console.log('  Przerywam muzykę (brak uprawnień lub kredytów).'); break; }
    }
  }
}

// js/audio-sfx.js i js/audio-music.js: G.audioBank.sfx[nazwa] = 'base64...'
function buildBank(kind) {
  const dir = path.join(ROOT, 'audio', kind);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort() : [];
  let js = `'use strict';\n// Wygenerowane przez tools/generate-audio.mjs, nie edytuj ręcznie.\n`;
  js += `window.G.audioBank = window.G.audioBank || {};\nwindow.G.audioBank.${kind} = {\n`;
  for (const f of files) {
    js += `  ${JSON.stringify(f.replace(/\.mp3$/, ''))}: '${fs.readFileSync(path.join(dir, f)).toString('base64')}',\n`;
  }
  js += '};\n';
  fs.writeFileSync(path.join(ROOT, 'js', `audio-${kind}.js`), js);
  console.log(`js/audio-${kind}.js: ${files.length} plików, ${(js.length / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------- start
if (!flag('bank')) {
  const key = loadKey();
  if (wantSfx) await genSfx(key);
  if (wantMusic) await genMusic(key);
}
buildBank('sfx');
buildBank('music');
