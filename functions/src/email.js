'use strict';
// Email delivery via Resend. The API key is ONLY read from the environment
// (Cloud Functions secret) — it must never appear in code or the client.
async function sendViaResend({ to, subject, html, from }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not configured — skipping send of "' + subject + '"');
    return { skipped: true };
  }
  const recipients = Array.isArray(to) ? to : [to];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({
      from: from || 'PulseGrid Alerts <alerts@resend.dev>',
      to: recipients,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('Resend API error ' + res.status + (body ? ': ' + body.slice(0, 200) : ''));
  }
  return { sent: true };
}

module.exports = { sendViaResend };
