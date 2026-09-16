// Krok 2: cykliczne sprawdzanie ceny.
//   node monitor.mjs --once     # jedno sprawdzenie (do Harmonogramu zadan Windows / crona)
//   node monitor.mjs --watch    # petla w tle wg poll.intervalMinutes

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, acceptCookies } from './lib/browser.mjs';
import { domExtractor, normalize, pickTarget } from './lib/extract.mjs';
import { appendHistory, lastEntry, writeCsv, ensureDir } from './lib/store.mjs';
import { notify } from './lib/notify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));
const dataDir = ensureDir(path.join(here, 'data'));
const watch = process.argv.includes('--watch');

async function fetchOffers() {
  const { browser, page } = await openPage(cfg);
  try {
    await page.goto(cfg.bookingUrl, { waitUntil: 'domcontentloaded', timeout: cfg.browser?.waitMs ?? 45000 });
    await acceptCookies(page);

    // czekamy az wyniki sie dorenderuja (SPA) - max waitMs
    const deadline = Date.now() + (cfg.browser?.waitMs ?? 45000);
    let result = { offers: [] };
    while (Date.now() < deadline) {
      result = normalize(await page.evaluate(domExtractor));
      if (result.offers.length >= 3) break;
      await page.waitForTimeout(2000);
    }

    if (!result.offers.length) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dbg = ensureDir(path.join(here, 'capture'));
      fs.writeFileSync(path.join(dbg, `${stamp}-empty.html`), await page.content());
      await page.screenshot({ path: path.join(dbg, `${stamp}-empty.png`), fullPage: true });
    }
    return result;
  } finally {
    await browser.close();
  }
}

function compare(prev, target, best) {
  const before = prev?.results?.find(r => r.target === target.name)?.best?.price ?? null;
  if (before === null || !best) return { before, delta: null, deltaPct: null };
  const delta = Math.round((best.price - before) * 100) / 100;
  const deltaPct = before ? Math.round((delta / before) * 10000) / 100 : null;
  return { before, delta, deltaPct };
}

async function runOnce() {
  const ts = new Date().toISOString();
  const prev = lastEntry(dataDir);
  let result;
  try {
    result = await fetchOffers();
  } catch (e) {
    console.error(`[${ts}] blad pobierania: ${e.message}`);
    return;
  }

  const alerts = [];
  const results = (cfg.targets ?? []).map((t) => {
    const best = pickTarget(result.offers, t);
    const cmp = compare(prev, t, best);
    if (best) {
      const minDelta = cfg.alerts?.minDeltaPct ?? 1;
      const dropped = cmp.deltaPct !== null && cmp.deltaPct <= -minDelta;
      const rose = cmp.deltaPct !== null && cmp.deltaPct >= minDelta;
      const underCap = t.maxPrice != null && best.price <= t.maxPrice;
      const firstSeen = cmp.before === null;
      if ((cfg.alerts?.onDrop !== false && dropped) || (cfg.alerts?.onRise && rose) ||
          (underCap && (firstSeen || dropped))) {
        alerts.push(
          `${t.name}: ${best.price} ${best.currency}` +
          (cmp.before !== null ? ` (bylo ${cmp.before}, ${cmp.delta > 0 ? '+' : ''}${cmp.delta} / ${cmp.deltaPct}%)` : ' (pierwszy odczyt)') +
          (underCap ? `  <= prog ${t.maxPrice}` : '') +
          `\n  ${best.title}`
        );
      }
    }
    return { target: t.name, best, ...cmp };
  });

  const entry = { ts, url: cfg.bookingUrl, offersFound: result.offers.length, results };
  appendHistory(dataDir, entry);
  writeCsv(dataDir, entry);

  const summary = results
    .map(r => `  ${r.target}: ${r.best ? `${r.best.price} ${r.best.currency} - ${r.best.title}` : 'brak dopasowania'}`)
    .join('\n');
  console.log(`[${ts}] ofert na stronie: ${result.offers.length}\n${summary}`);

  if (alerts.length) {
    await notify(cfg, 'Goldcar: zmiana ceny', `${alerts.join('\n\n')}\n\n${cfg.bookingUrl}`);
  }
}

if (watch) {
  const base = (cfg.poll?.intervalMinutes ?? 180) * 60_000;
  const jitter = (cfg.poll?.jitterMinutes ?? 20) * 60_000;
  for (;;) {
    await runOnce();
    const wait = base + Math.floor(Math.random() * jitter);
    console.log(`nastepne sprawdzenie za ~${Math.round(wait / 60000)} min`);
    await new Promise(r => setTimeout(r, wait));
  }
} else {
  await runOnce();
}
