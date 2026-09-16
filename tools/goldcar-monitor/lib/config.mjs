import fs from 'node:fs';
import path from 'node:path';

// Prosty parser .env - tylko KEY=VALUE, bez eksportow i podstawien powloki.
export function loadEnvFile(dir) {
  const f = path.join(dir, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;   // env systemowy ma pierwszenstwo
  }
}

// Podstawia ${ZMIENNA} w stringach configu wartosciami z process.env.
function expand(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{(\w+)\}/g, (m, name) => process.env[name] ?? m);
  }
  if (Array.isArray(value)) return value.map(expand);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v)]));
  }
  return value;
}

export function loadConfig(dir) {
  loadEnvFile(dir);
  const file = path.join(dir, 'config.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Brak ${file} - skopiuj config.example.json i uzupelnij.`);
  }
  const cfg = expand(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!cfg.bookingUrl) throw new Error('config.json: pusty "bookingUrl".');
  if (!Array.isArray(cfg.targets) || !cfg.targets.length) throw new Error('config.json: pusta lista "targets".');
  const unresolved = JSON.stringify(cfg).match(/\$\{\w+\}/g);
  if (unresolved) throw new Error(`Nierozwiniete zmienne: ${[...new Set(unresolved)].join(', ')} - ustaw je w .env`);
  return cfg;
}
