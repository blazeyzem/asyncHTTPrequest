# Goldcar price monitor

Monitor ceny **konkretnego terminu** wynajmu w Goldcar: skrypt otwiera stronę wyników
w Chromium (Playwright), wyciąga ceny, zapisuje historię i alarmuje, gdy cena spadnie
poniżej progu albo zmieni się o zadany procent.

## Dlaczego przez przeglądarkę

Strona Goldcar renderuje wyniki po stronie klienta i chroni je przed zwykłym `curl`-em.
Krok `discover` nagrywa ruch XHR — jeśli w zrzucie znajdzie się czyste API z cenami,
można przestawić monitor na bezpośrednie odpytywanie JSON-a (szybciej, bez przeglądarki).

## Instalacja (Windows)

```cmd
cd D:\Claude\goldcar-monitor
npm install
npx playwright install chromium
copy config.example.json config.json
```

## Konfiguracja

1. Wejdź na goldcar.es, wyszukaj swój termin (miejsce odbioru/zwrotu, daty, godziny).
2. Skopiuj URL strony z wynikami i wklej go do `config.json` jako `bookingUrl`.
3. Ustaw `targets` — każdy cel to nazwa, `match` (regex po nazwie/opisie oferty)
   i `maxPrice` (próg alertu). `"match": ".*"` = najtańsza oferta z listy.

## Użycie

```cmd
node discover.mjs --headed   :: jednorazowo: zrzut XHR + HTML + screenshot do capture\
node monitor.mjs --once      :: jedno sprawdzenie
node monitor.mjs --watch     :: pętla wg poll.intervalMinutes
node test\smoke.mjs          :: test ekstraktora na lokalnym fixture
```

Wyniki lądują w `data\history.jsonl` (pełne) i `data\history.csv` (do Excela).
Alert leci na konsolę, opcjonalnie na webhook i/lub e-mail (SMTP w `config.json`).

## Harmonogram zadań Windows

```cmd
schtasks /create /tn "Goldcar price" /tr "D:\Claude\goldcar-monitor\run-check.cmd" /sc hourly /mo 3
```

## Uwagi

- `intervalMinutes` domyślnie 180 + losowy jitter — nie zalewamy serwisu zapytaniami.
- Jeśli monitor nie znajdzie ofert, zrzuca HTML i screenshot do `capture\` — po tym
  zrzucie da się poprawić ekstraktor pod aktualny layout strony.
- `config.json` (z hasłem SMTP) i `data\` są w `.gitignore`.
