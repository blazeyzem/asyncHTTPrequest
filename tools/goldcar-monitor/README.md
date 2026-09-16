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

Sekrety idą do `.env` (chmod 600), nie do `config.json` — w configu zostają tylko
placeholdery `${SMTP_USER}` / `${SMTP_PASS}`, które loader podstawia przy starcie
i przerywa z czytelnym błędem, gdy któraś zmienna jest nieustawiona.

```bash
cp .env.example .env && chmod 600 .env
```

Gmail: potrzebne **hasło aplikacji** (Konto Google → Bezpieczeństwo → Hasła do aplikacji).
Zwykłe hasło nie przejdzie przy weryfikacji dwuetapowej. Test bez czekania na zmianę ceny:

```bash
node monitor.mjs --test-mail
```


1. Wejdź na goldcar.es, wyszukaj swój termin (miejsce odbioru/zwrotu, daty, godziny).
2. Skopiuj URL strony z wynikami i wklej go do `config.json` jako `bookingUrl`.
3. Ustaw `targets` — każdy cel to nazwa, `match` (regex po nazwie/opisie oferty)
   i `maxPrice` (próg alertu). `"match": ".*"` = najtańsza oferta z listy.

## Użycie

```cmd
node discover.mjs --headed   :: jednorazowo: zrzut XHR + HTML + screenshot do capture\
node monitor.mjs --once      :: jedno sprawdzenie
node monitor.mjs --watch     :: pętla wg poll.intervalMinutes
node monitor.mjs --test-mail :: sprawdzenie samego SMTP
node test\smoke.mjs          :: test ekstraktora na lokalnym fixture
```

Wyniki lądują w `data\history.jsonl` (pełne) i `data\history.csv` (do Excela).
Alert leci na konsolę, opcjonalnie na webhook i/lub e-mail (SMTP w `config.json`).

## Wdrożenie na serwerze (app01)

Z katalogu repo na maszynie:

```bash
git clone -b claude/goldcar-price-monitoring-ip20rl https://github.com/blazeyzem/asyncHTTPrequest.git
cd asyncHTTPrequest/tools/goldcar-monitor

sudo ./deploy/install.sh          # /opt/goldcar-monitor + systemd timer co 3h (+ jitter 25 min)
sudo nano /opt/goldcar-monitor/config.json
sudo systemctl start goldcar-monitor.service      # pierwsze sprawdzenie od razu
journalctl -u goldcar-monitor.service -f
```

Wariant kontenerowy (monitor chodzi w pętli `--watch`, restart po reboocie):

```bash
cp config.example.json deploy/config.json && nano deploy/config.json
./deploy/install.sh --docker
docker logs -f goldcar-monitor
```

Zmienne: `APP_DIR` (domyślnie `/opt/goldcar-monitor`), `RUN_USER` (domyślnie wywołujący).
Jeśli na maszynie nie da się pobrać Chromium z CDN Playwrighta, zainstaluj systemowy
(`apt install chromium`) i ustaw `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium` — skrypty to honorują.

## Harmonogram zadań Windows

```cmd
schtasks /create /tn "Goldcar price" /tr "D:\Claude\goldcar-monitor\run-check.cmd" /sc hourly /mo 3
```

## Uwagi

- `intervalMinutes` domyślnie 180 + losowy jitter — nie zalewamy serwisu zapytaniami.
- Jeśli monitor nie znajdzie ofert, zrzuca HTML i screenshot do `capture\` — po tym
  zrzucie da się poprawić ekstraktor pod aktualny layout strony.
- `config.json` (z hasłem SMTP) i `data\` są w `.gitignore`.
