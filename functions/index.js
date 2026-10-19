'use strict';
// PulseGrid Cloud Functions entry point (1st gen, us-central1):
//   api            — HTTP POST /api (ID-token auth): checkAll / checkMonitor / sendReportEmail
//   scheduledCheck — Cloud Scheduler, every minute: runs monitors that are due,
//                    skipping paused/inactive ones. intervalSeconds per monitor is honored.
// Secrets: RESEND_API_KEY is set with `firebase functions:secrets:set RESEND_API_KEY`
// and is read from the environment at runtime. It must never be hardcoded here.
const functions = require('firebase-functions');
const core = require('./src/core');
const checks = require('./src/checks');
const monitoring = require('./src/monitoring');
const email = require('./src/email');
const store = require('./src/store');
const { handle } = require('./src/api');

exports.api = functions.https.onRequest((req, res) => handle(req, res).catch((e) => {
  console.error('api error', e);
  if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
}));

exports.scheduledCheck = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const now = Date.now();
  const all = await store.repo.listAllActiveMonitors();
  const due = core.selectDueMonitors(all, now);
  if (due.length === 0) return null;
  const summary = await monitoring.runAll({
    monitors: due,
    repo: store.repo,
    checkRegion: checks.checkMonitor,
    sendEmail: email.sendViaResend,
    now,
  });
  console.log('[scheduledCheck] checked=' + summary.checked + ' down=' + summary.down);
  return null;
});
