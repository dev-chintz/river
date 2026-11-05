# Delta Strike

Pionowa strzelanka nad rzeką. Ma nowoczesną grafikę generowaną proceduralnie i działa w czystym HTML5 Canvas i JavaScript, bez bibliotek i bez budowania.

## Uruchomienie

Otwórz `index.html` w przeglądarce (Chrome, Edge, Firefox). Możesz też uruchomić lokalny serwer:

```bash
python -m http.server 8137
```

i wejść na http://localhost:8137

## Tryby

- **Kampania**: 8 sektorów, forteczne bossy w sektorach 3, 6 i 8.
- **Bez końca**: nieskończona rzeka z rosnącą trudnością, boss co 5 sektorów.
- **Na czas**: 3 minuty. Każda brama daje +10 s, każda strata maszyny zabiera −15 s.

## Zasady

- Maszyna leci z nurtem rzeki: sterujesz tylko na boki, a przepustnicą zmieniasz prędkość lotu.
- Każdy kontakt z brzegiem rzeki, ścianą kanionu lub wyspą kończy lot. Zderzenie z łodzią, dronem, śmigłowcem, miną albo generatorem bramy też. Czerwona poświata przy skrzydle ostrzega, że ściana jest blisko.
- Pociski wroga zdejmują pancerz, a gdy spadnie do zera, maszyna ginie.
- Rzeka przeplata szerokie rozlewiska z wąskimi, krętymi kanionami. Z każdym sektorem jest ciaśniej.
- Reaktor stale traci energię, szybciej przy większej prędkości. Tankujesz, lecąc nad pływającą stacją energii (zwolnij, żeby zatankować więcej). Stację można zestrzelić, więc nie strzelaj, kiedy nad nią lecisz. Niebieskie pierścienie to rzadszy bonus energii.
- Po odrodzeniu przez 3 s działa osłona: brzeg wtedy tylko odpycha.
- Brama z polem siłowym kończy każdy sektor. Żeby przelecieć, zniszcz oba generatory przy brzegach.
- Każdy sektor ma własny krajobraz i porę dnia: łąki, rozlewiska, kanion z piaskowca, mokradła we mgle, granitowy przełom, zmierzch i zachód słońca.
- Szybkie serie zestrzeleń podnoszą mnożnik punktów, maksymalnie do x8.
- Znajdźki: **W** to ulepszenie broni (4 poziomy), **M** to +3 rakiety, **+** to naprawa pancerza.

## Sterowanie

| Klawisz | Akcja |
|---|---|
| ← → / A D | skręt |
| ↑ / W, ↓ / S | przyspieszenie, hamowanie |
| Spacja / Z / J | działka |
| X / K / Shift | para rakiet samonaprowadzających |
| P / Esc | pauza |
| M | muzyka wł./wył. |

Działa też gamepad (gałka, A, X/RB, Start) i dotyk (przeciągnij palcem, dwa palce odpalają rakiety). Przy dotyku działka strzelają same, więc nie niszczą stacji energii.

## Struktura

- `js/terrain.js`: geometria rzeki (rozlewiska, kaniony, wyspy), biomy, teren liczony per piksel z oświetleniem i klifami, woda, chmury
- `js/post.js`: bloom i korekcja barwna sektorów
- `js/sprites.js`: wszystkie grafiki rysowane kodem
- `js/entities.js`, `js/boss.js`: gracz, przeciwnicy, stacje energii, bramy, znajdźki, boss
- `js/level.js`: sektory, układ kanionów, wygląd sektorów i rozmieszczanie przeciwników
- `js/game.js`: logika rozgrywki
- `js/ui.js`: HUD i menu
- `js/audio.js`: warstwa dźwiękowa (próbki, miks, muzyka z płynnymi pętlami; zapasowa synteza WebAudio)
- `js/audio-sfx.js`, `js/audio-music.js`: wygenerowane próbki zakodowane base64 (nie edytować ręcznie)
- `audio/`: te same próbki jako pliki mp3
- `tools/generate-audio.mjs`: generator dźwięków (ElevenLabs)

## Dźwięk

Efekty i muzyka powstały w ElevenLabs (Sound Effects i Music API). Gra zawiera gotowe pliki, więc do grania klucz nie jest potrzebny.

Żeby wygenerować coś od nowa, wpisz klucz do `.env` (`ELEVENLABS_API_KEY=...`, plik jest w `.gitignore`) i uruchom:

```bash
node tools/generate-audio.mjs --only=shoot_1,boss --force
```

Bez `--force` generator pomija istniejące pliki, więc kredyty nie przepadają. Opisy dźwięków i utworów są na górze skryptu. Po każdym uruchomieniu skrypt przebudowuje `js/audio-*.js`.
