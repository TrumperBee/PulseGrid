'use strict';
// HTTP API: POST /api with a Firebase ID token. Used by the web app for
// "Check Now", single-monitor checks and report emails.
const core = require('./core');
const checks = require('./checks');
const monitoring = require('./monitoring');
const email = require('./email');
const { repo, admin } = require('./store');

function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

async function handle(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing Authorization token' });
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const uid = decoded.uid;

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const { action, monitorId, reportType, monitorIds } = body;

  if (action === 'checkAll') {
    const monitors = (await repo.listMonitorsForUser(uid)).filter((m) => !m.isPaused);
    const summary = await monitoring.runAll({ monitors, repo, checkRegion: checks.checkMonitor, sendEmail: email.sendViaResend });
    return res.json({ ok: true, checked: summary.checked, down: summary.down, avgResponseMs: summary.avgResponseMs });
  }

  if (action === 'checkMonitor') {
    const monitor = await repo.getMonitor(monitorId);
    if (!monitor || monitor.userId !== uid) return res.status(404).json({ error: 'Monitor not found' });
    if (monitor.isPaused) return res.status(400).json({ error: 'Monitor is paused' });
    const summary = await monitoring.runAll({ monitors: [monitor], repo, checkRegion: checks.checkMonitor, sendEmail: email.sendViaResend });
    return res.json({ ok: true, checked: summary.checked, down: summary.down, result: summary.results[0] });
  }

  if (action === 'sendReportEmail') {
    if (!decoded.email) return res.status(400).json({ error: 'No email on account' });
    let monitors = await repo.listMonitorsForUser(uid);
    if (Array.isArray(monitorIds) && monitorIds.length > 0) {
      monitors = monitors.filter((m) => monitorIds.includes(m.id));
    }
    if (monitors.length === 0) return res.status(400).json({ error: 'No monitors to include in report' });
    const periodLabel = reportType === 'daily' ? 'Daily Report' : reportType === 'weekly' ? 'Weekly Report' : reportType === 'monthly' ? 'Monthly Report' : 'Custom Report';
    const outcome = await email.sendViaResend({
      to: decoded.email,
      subject: 'PulseGrid Report - ' + periodLabel,
      html: core.buildReportEmailHtml({ periodLabel, monitors }),
      from: 'PulseGrid Reports <reports@resend.dev>',
    });
    return res.json({ ok: true, ...outcome, to: decoded.email });
  }

  return res.status(400).json({ error: 'Unknown action' });
}

module.exports = { handle };
