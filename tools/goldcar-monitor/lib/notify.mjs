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
      const { default: nodemailer } = await import('nodemailer');
      const t = nodemailer.createTransport(n.email.smtp);
      await t.sendMail({
        from: n.email.from || n.email.smtp.user,
        to: n.email.to,
        subject,
        text: body,
      });
    } catch (e) { console.error('email:', e.message); }
  }
}
