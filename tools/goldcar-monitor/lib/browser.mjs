import { chromium } from 'playwright';

export async function openPage(cfg) {
  const b = cfg.browser ?? {};
  const browser = await chromium.launch({
    headless: b.headless !== false,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  });
  const context = await browser.newContext({
    locale: b.locale || 'pl-PL',
    timezoneId: b.timezoneId || 'Europe/Warsaw',
    ...(b.userAgent ? { userAgent: b.userAgent } : {}),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  return { browser, context, page };
}

// Klika typowe bannery zgody na cookies (roznie nazywane w zaleznosci od jezyka).
export async function acceptCookies(page) {
  const labels = [/akceptuj/i, /zgadzam/i, /accept all/i, /aceptar/i, /got it/i, /allow all/i];
  for (const re of labels) {
    const btn = page.getByRole('button', { name: re }).first();
    try {
      if (await btn.isVisible({ timeout: 1500 })) { await btn.click({ timeout: 3000 }); return true; }
    } catch { /* brak bannera albo inny selektor */ }
  }
  return false;
}
