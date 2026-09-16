#!/usr/bin/env bash
# Instalacja monitora na app01. Idempotentne - mozna puszczac wielokrotnie.
#
#   sudo ./deploy/install.sh              # tryb systemd (timer co 3h)
#   ./deploy/install.sh --docker          # tryb docker compose (watch)
#
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-/opt/goldcar-monitor}"
RUN_USER="${RUN_USER:-${SUDO_USER:-${USER:-$(id -un)}}}"
MODE="systemd"
[[ "${1:-}" == "--docker" ]] && MODE="docker"

log() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m!!\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "$MODE" == "docker" ]]; then
  command -v docker >/dev/null || die "brak dockera na tej maszynie"
  [[ -f "$SRC_DIR/deploy/config.json" ]] || die "utworz deploy/config.json (wzor: config.example.json)"
  [[ -f "$SRC_DIR/deploy/.env" ]] || die "utworz deploy/.env (wzor: .env.example) z SMTP_USER i SMTP_PASS"
  chmod 600 "$SRC_DIR/deploy/.env"
  mkdir -p "$SRC_DIR/deploy/data" "$SRC_DIR/deploy/capture"
  log "buduje obraz i startuje kontener"
  docker compose -f "$SRC_DIR/deploy/docker-compose.yml" up -d --build
  log "gotowe. logi: docker logs -f goldcar-monitor"
  exit 0
fi

command -v node >/dev/null || die "brak node (potrzebny >=20): apt install nodejs albo nvm"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= 20 )) || die "node $NODE_MAJOR jest za stary, potrzebny >=20"

log "kopiuje pliki do $APP_DIR"
mkdir -p "$APP_DIR"
for item in package.json monitor.mjs discover.mjs lib test config.example.json .env.example; do
  cp -r "$SRC_DIR/$item" "$APP_DIR/"
done
mkdir -p "$APP_DIR/data" "$APP_DIR/capture"

if [[ ! -f "$APP_DIR/config.json" ]]; then
  cp "$SRC_DIR/config.example.json" "$APP_DIR/config.json"
  log "utworzono $APP_DIR/config.json z szablonu - UZUPELNIJ bookingUrl i targets"
fi
chmod 600 "$APP_DIR/config.json"

if [[ ! -f "$APP_DIR/.env" ]]; then
  cp "$SRC_DIR/.env.example" "$APP_DIR/.env"
  log "utworzono $APP_DIR/.env - wpisz SMTP_USER i SMTP_PASS (haslo aplikacji Google)"
fi
chmod 600 "$APP_DIR/.env"

log "instaluje zaleznosci i Chromium"
( cd "$APP_DIR" && PLAYWRIGHT_BROWSERS_PATH="$APP_DIR/.ms-playwright" npm install --omit=dev --no-audit --no-fund )
pw_args=(chromium)
[[ $EUID -eq 0 ]] && pw_args=(--with-deps chromium)
if ( cd "$APP_DIR" && PLAYWRIGHT_BROWSERS_PATH="$APP_DIR/.ms-playwright" npx playwright install "${pw_args[@]}" ); then
  [[ $EUID -eq 0 ]] || log "bez roota pominieto --with-deps; jesli Chromium nie wstanie: sudo npx playwright install-deps chromium"
else
  log "nie udalo sie pobrac Chromium (firewall/proxy?)."
  log "Obejscie: zainstaluj chromium z repo dystrybucji i wskaz go monitorowi, np."
  log "  sudo apt install -y chromium && echo 'PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium' >> $APP_DIR/.env"
  log "  (albo Environment=PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium w unicie systemd)"
fi
chown -R "$RUN_USER" "$APP_DIR"

if command -v systemctl >/dev/null && [[ $EUID -eq 0 ]]; then
  log "instaluje unit + timer (uzytkownik: $RUN_USER)"
  sed -e "s|__APP_DIR__|$APP_DIR|g" -e "s|__RUN_USER__|$RUN_USER|g" \
      "$SRC_DIR/deploy/goldcar-monitor.service" > /etc/systemd/system/goldcar-monitor.service
  cp "$SRC_DIR/deploy/goldcar-monitor.timer" /etc/systemd/system/goldcar-monitor.timer
  systemctl daemon-reload
  systemctl enable --now goldcar-monitor.timer
  log "timer aktywny:"
  systemctl list-timers goldcar-monitor.timer --no-pager || true
else
  log "pominieto systemd (brak roota lub systemctl). Recznie: cd $APP_DIR && node monitor.mjs --once"
fi

cat <<TXT

Gotowe. Dalej:
  1. uzupelnij $APP_DIR/config.json  (bookingUrl, targets, notify)
  2. sekrety:     $APP_DIR/.env  (SMTP_USER, SMTP_PASS)
  3. test poczty: cd $APP_DIR && node monitor.mjs --test-mail
  4. test ekstraktora: cd $APP_DIR && node test/smoke.mjs
  5. zwiad:       cd $APP_DIR && node discover.mjs
  6. jedno biegniecie: sudo systemctl start goldcar-monitor.service
  7. logi:        journalctl -u goldcar-monitor.service -f
  8. historia:    $APP_DIR/data/history.csv
TXT
