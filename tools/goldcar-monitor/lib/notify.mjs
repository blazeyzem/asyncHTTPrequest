let transportCache = null;

async function getTransport(email) {
  if (transportCache) return transportCache;
  const { default: nodemailer } = await import('nodemailer');
  transportCache = nodemailer.createTransport(email.smtp);
  return transportCache;
}

export async function sendMail(cfg, subject, body) {
  const email = cfg.notify?.email;
  if (!email?.enabled) return { skipped: 'email wylaczony w config.json' };
  if (!email.to) throw new Error('notify.email.to jest puste');
  const t = await getTransport(email);
  const info = await t.sendMail({
    from: email.from || email.smtp?.auth?.user || email.smtp?.user,
    to: email.to,
    subject,
    text: body,
  });
  return { messageId: info.messageId, accepted: info.accepted, response: info.response };
}

export async function verifyMail(cfg) {
  const email = cfg.notify?.email;
  if (!email?.enabled) throw new Error('notify.email.enabled = false');
  const t = await getTransport(email);
  if (typeof t.verify === 'function') await t.verify();
  return true;
}

export async function notify(cfg, subject, body) {
  const n = cfg.notify ?? {};
  if (n.console !== false) console.log(`\n=== ${subject} ===\n${body}\n`);

  if (n.webhook) {
    try {
      await fetch(n.webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
    } catch (e) { console.error('webhook:', e.message); }
  }

  if (n.email?.enabled) {
    try {
      const r = await sendMail(cfg, subject, body);
      console.log(`mail -> ${n.email.to} (${r.messageId ?? r.skipped})`);
    } catch (e) { console.error('email:', e.message); }
  }
}
