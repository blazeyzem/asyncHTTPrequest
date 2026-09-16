# Baza node + Chromium instalowany przez samo Playwright, dzieki czemu wersja
# przegladarki zawsze pasuje do wersji biblioteki z package.json.
FROM node:22-bookworm-slim

ENV TZ=Europe/Warsaw \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && npx playwright install --with-deps chromium \
 && npm cache clean --force

COPY . .

# config.json i data/ montujemy z hosta (volume) - patrz docker-compose.yml
VOLUME ["/app/data"]

CMD ["node", "monitor.mjs", "--watch"]
