import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { parsePrice, domExtractor, normalize, pickTarget } from '../lib/extract.mjs';

assert.equal(parsePrice('189,90'), 189.9);
assert.equal(parsePrice('1 245,50'), 1245.5);
assert.equal(parsePrice('1,234.56'), 1234.56);
assert.equal(parsePrice('1,234'), 1234);
assert.equal(parsePrice('412'), 412);
console.log('parsePrice ok');

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const file = 'file://' + path.resolve('test/fixture-results.html');
await page.goto(file);
const res = normalize(await page.evaluate(domExtractor));
await browser.close();

console.log(res.offers.map(o => `${o.price} ${o.currency} | ${o.title}`).join('\n'));
assert.equal(res.offers.length, 3, 'oczekiwano 3 ofert');
const corsa = pickTarget(res.offers, { match: 'corsa' });
assert.equal(corsa.price, 1245.5);
const cheapest = pickTarget(res.offers, { match: '.*' });
assert.equal(cheapest.price, 189.9);
console.log('extractor ok');
