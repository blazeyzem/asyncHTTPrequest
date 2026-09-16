// Krok 1 (jednorazowy): otwiera strone wynikow, nagrywa ruch XHR/JSON i zrzuca DOM.
// Dzieki temu mozna potem odpytywac API bezposrednio zamiast renderowac strone.
//
//   node discover.mjs                 # uzywa bookingUrl z config.json
//   node discover.mjs "<URL>"         # albo URL podany wprost
//   node discover.mjs --headed        # z widoczna przegladarka (mozna kliknac samemu)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, acceptCookies } from './lib/browser.mjs';
import { domExtractor, normalize } from './lib/extract.mjs';
import { ensureDir } from './lib/store.mjs';

const cfg = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./config.json', import.meta.url)), 'utf8'));
const args = process.argv.slice(2);
if (args.includes('--headed')) cfg.browser = { ...cfg.browser, headless: false };
const url = args.find(a => a.startsWith('http')) || cfg.bookingUrl;
if (!url) {
  console.error('Brak URL. Ustaw "bookingUrl" w config.json albo podaj adres jako argument.');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = ensureDir(path.join(here, 'capture'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const calls = [];

const { browser, page } = await openPage(cfg);

page.on('response', async (res) => {
  const req = res.request();
  const u = res.url();
  const ct = (res.headers()['content-type'] || '');
  if (!/json/i.test(ct)) return;
  if (/analytics|gtm|google|facebook|hotjar|sentry|cookie/i.test(u)) return;
  let body = null;
  try { body = await res.text(); } catch { /* np. przekierowanie albo body juz zwolnione */ }
  calls.push({
    url: u,
    method: req.method(),
    status: res.status(),
    requestHeaders: req.headers(),
    postData: req.postData() ?? null,
    bodyPreview: body ? body.slice(0, 20000) : null,
    bodyBytes: body ? body.length : 0,
  });
  console.log(`[xhr] ${req.method()} ${res.status()} ${u.slice(0, 140)}`);
});

console.log('Otwieram:', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cfg.browser?.waitMs ?? 45000 });
await acceptCookies(page);
await page.waitForTimeout(cfg.browser?.headless === false ? 60000 : 12000);

const raw = await page.evaluate(domExtractor);
const result = normalize(raw);

fs.writeFileSync(path.join(outDir, `${stamp}-xhr.json`), JSON.stringify(calls, null, 2));
fs.writeFileSync(path.join(outDir, `${stamp}-page.html`), await page.content());
fs.writeFileSync(path.join(outDir, `${stamp}-offers.json`), JSON.stringify(result, null, 2));
await page.screenshot({ path: path.join(outDir, `${stamp}-page.png`), fullPage: true });

console.log(`\nZapisano do ${outDir}`);
console.log(`Znalezione kwoty na stronie: ${result.offers.length}`);
for (const o of result.offers.slice(0, 25)) console.log(`  ${o.price} ${o.currency}  <-  ${o.title}`);

await browser.close();
