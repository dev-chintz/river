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

- Reaktor stale traci energię, szybciej przy większej prędkości. Uzupełnia go przelot przez niebieskie pierścienie, a każde zestrzelenie dodaje trochę energii.
- Brzegi uszkadzają pancerz, więc trzymaj się wody.
- Brama z polem siłowym kończy każdy sektor. Żeby przelecieć, zniszcz oba generatory przy brzegach.
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

Działa też gamepad (gałka, A, X/RB, Start) i dotyk (przeciągnij palcem, dwa palce odpalają rakiety).

## Struktura

- `js/terrain.js`: geometria rzeki, teren liczony per piksel z oświetleniem, woda, chmury
- `js/sprites.js`: wszystkie grafiki rysowane kodem
- `js/entities.js`, `js/boss.js`: gracz, przeciwnicy, bramy, znajdźki, boss
- `js/level.js`: sektory i rozmieszczanie przeciwników
- `js/game.js`: logika rozgrywki
- `js/ui.js`: HUD i menu
- `js/audio.js`: syntezowane efekty i muzyka
