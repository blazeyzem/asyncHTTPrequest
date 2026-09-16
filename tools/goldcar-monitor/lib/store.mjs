import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }

export function appendHistory(dir, entry) {
  ensureDir(dir);
  fs.appendFileSync(path.join(dir, 'history.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
}

export function lastEntry(dir) {
  const f = path.join(dir, 'history.jsonl');
  if (!fs.existsSync(f)) return null;
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch { /* pomijamy uszkodzony wiersz */ }
  }
  return null;
}

export function writeCsv(dir, entry) {
  ensureDir(dir);
  const f = path.join(dir, 'history.csv');
  if (!fs.existsSync(f)) fs.writeFileSync(f, 'timestamp,target,title,price,currency\n', 'utf8');
  const rows = entry.results
    .filter(r => r.best)
    .map(r => [entry.ts, r.target, JSON.stringify(r.best.title), r.best.price, r.best.currency].join(','));
  if (rows.length) fs.appendFileSync(f, rows.join('\n') + '\n', 'utf8');
}
