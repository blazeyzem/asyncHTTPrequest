// Ekstrakcja ofert ze strony wynikow. Dziala jako heurystyka DOM-owa:
// szuka kwot w tekscie, a nastepnie wspina sie do najblizszego "kafelka" oferty.

export function parsePrice(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/\s| /g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // ostatni separator decyduje o czesci dziesietnej
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (hasComma) {
    // "1,234" to tysiace, "12,34" to grosze
    s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// Funkcja wykonywana w kontekscie przegladarki (page.evaluate).
export const domExtractor = () => {
  const PRICE_RE = /(?:(€|EUR|PLN|zł|£|GBP|\$|USD)\s*([\d][\d ., ]*\d|\d)|([\d][\d ., ]*\d|\d)\s*(€|EUR|PLN|zł|£|GBP|\$|USD))/i;
  const TITLE_SEL = 'h1,h2,h3,h4,h5,h6,[class*="title" i],[class*="name" i],[class*="model" i],[class*="car" i],[class*="vehicle" i],[class*="group" i]';
  const seen = new Set();
  const offers = [];

  const nodes = document.querySelectorAll('body *');
  for (const el of nodes) {
    if (el.children.length !== 0) continue;             // tylko liscie
    const txt = (el.textContent || '').trim();
    if (!txt || txt.length > 40) continue;
    const m = txt.match(PRICE_RE);
    if (!m) continue;
    const currency = (m[1] || m[4] || '').toUpperCase();
    const amountRaw = m[2] || m[3];
    if (!amountRaw) continue;

    // znajdz kontener oferty
    let card = el, title = '', hops = 0;
    while (card && hops < 8) {
      card = card.parentElement;
      if (!card) break;
      hops++;
      const t = (card.innerText || '').trim();
      if (t.length > 900) break;
      const h = card.querySelector(TITLE_SEL);
      const ht = h && (h.innerText || '').trim();
      if (ht && ht.length > 1 && ht.length < 120 && !PRICE_RE.test(ht)) { title = ht; break; }
    }
    const context = card ? (card.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 300) : txt;
    const key = `${title}|${amountRaw}|${currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({ title: title || '(bez nazwy)', amountRaw, currency, context });
  }
  return { url: location.href, title: document.title, offers };
};

export function normalize(result) {
  const offers = result.offers
    .map(o => ({ ...o, price: parsePrice(o.amountRaw) }))
    .filter(o => o.price !== null && o.price > 0);
  return { ...result, offers };
}

export function pickTarget(offers, target) {
  const re = new RegExp(target.match ?? '.*', 'i');
  const hits = offers.filter(o => re.test(o.title) || re.test(o.context));
  if (!hits.length) return null;
  return hits.reduce((min, o) => (o.price < min.price ? o : min));
}
