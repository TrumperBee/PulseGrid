'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runAll } = require('../src/monitoring');
const core = require('../src/core');

// In-memory fake repo + fake checks.
function makeWorld() {
  const monitors = new Map();
  const incidents = [];
  let incidentSeq = 0;
  const emails = [];
  const repo = {
    async getOpenIncidents(mid) { return incidents.filter((i) => i.monitorId === mid && !i.isResolved).map((i) => ({ ...i })); },
    async createIncident(data) { incidents.push({ id: 'inc-' + (++incidentSeq), ...data }); },
    async resolveIncident(id, extra) { const inc = incidents.find((i) => i.id === id); if (inc) { inc.isResolved = true; inc.resolvedAt = new Date(); } },
    async updateMonitor(id, updates) { monitors.set(id, { ...monitors.get(id), ...updates }); },
  };
  const checkRegion = async (monitor) => ({
    status: monitor._forceStatus || 'up',
    responseTimeMs: 120,
    checks: { connectivity: { passed: monitor._forceStatus !== 'down' }, fullLoad: { passed: monitor._forceStatus !== 'down', statusCode: 200 } },
    locationInfo: { name: 'Nairobi, Kenya' },
  });
  const sendEmail = async (msg) => { emails.push(msg); };
  return { monitors, incidents, emails, repo, checkRegion, sendEmail };
}

const mkMonitor = (over = {}) => ({
  id: 'm1', userId: 'u1', name: 'My API', url: 'https://example.com',
  locations: ['nairobi'], alertAfterFailures: 3, intervalSeconds: 300,
  alertContacts: ['alerts@example.com'], status: 'pending', isActive: true, isPaused: false,
  ...over,
});

test('pipeline: 3 failures → one incident + one down email; further failures add nothing; recovery resolves + recovered email', async () => {
  const w = makeWorld();
  w.monitors.set('m1', mkMonitor({ _forceStatus: 'down' }));
  let now = 1_000_000;

  for (let i = 1; i <= 4; i++) {
    const m = w.monitors.get('m1');
    await runAll({ monitors: [m], repo: w.repo, checkRegion: w.checkRegion, sendEmail: w.sendEmail, now });
    now += 300_000;
  }
  assert.equal(w.incidents.length, 1, 'exactly one incident for a continuous outage');
  assert.equal(w.incidents[0].isResolved, false);
  assert.equal(w.emails.filter((e) => e.subject.includes('DOWN')).length, 1, 'exactly one down email');
  assert.equal(w.monitors.get('m1').status, 'down');
  assert.equal(w.monitors.get('m1').consecutiveFailures, 4);

  // Recovery
  w.monitors.set('m1', { ...w.monitors.get('m1'), _forceStatus: 'up' });
  await runAll({ monitors: [w.monitors.get('m1')], repo: w.repo, checkRegion: w.checkRegion, sendEmail: w.sendEmail, now });
  assert.equal(w.incidents[0].isResolved, true, 'incident resolved on genuine recovery');
  assert.equal(w.emails.filter((e) => e.subject.includes('recovered')).length, 1, 'exactly one recovery email');
  const m = w.monitors.get('m1');
  assert.equal(m.status, 'up');
  assert.equal(m.consecutiveFailures, 0);
});

test('pipeline: uptime counters and percentage come only from real checks', async () => {
  const w = makeWorld();
  const m0 = mkMonitor();
  w.monitors.set('m1', m0);
  // 1 healthy check (1 region) → 1/1
  await runAll({ monitors: [m0], repo: w.repo, checkRegion: w.checkRegion, sendEmail: w.sendEmail });
  let m = w.monitors.get('m1');
  assert.equal(m.uptimeChecksTotal, 1);
  assert.equal(m.uptimeChecksPassed, 1);
  assert.equal(m.uptimePercentage, 100);
  // then a failure → 2/1
  w.monitors.set('m1', { ...m, _forceStatus: 'down' });
  await runAll({ monitors: [w.monitors.get('m1')], repo: w.repo, checkRegion: w.checkRegion, sendEmail: w.sendEmail });
  m = w.monitors.get('m1');
  assert.equal(m.uptimeChecksTotal, 2);
  assert.equal(m.uptimeChecksPassed, 1);
  assert.equal(m.uptimePercentage, 50);
  assert.ok(m.checkHistory.length >= 2, 'check history persisted');
});

test('pipeline: paused monitors are excluded by due-selection and never processed', async () => {
  const w = makeWorld();
  const paused = mkMonitor({ id: 'mp', isPaused: true, _forceStatus: 'down' });
  const active = mkMonitor({ id: 'ma' });
  const due = core.selectDueMonitors([paused, active], Date.now());
  assert.deepEqual(due.map((m) => m.id), ['ma']);
  const summary = await runAll({ monitors: due, repo: w.repo, checkRegion: w.checkRegion, sendEmail: w.sendEmail });
  assert.equal(summary.checked, 1);
  assert.equal(w.incidents.length, 0);
  assert.equal(w.emails.length, 0);
});

test('pipeline: nextCheckAt is scheduled from intervalSeconds', async () => {
  const w = makeWorld();
  const now = 5_000_000;
  w.monitors.set('m1', mkMonitor({ intervalSeconds: 120 }));
  await runAll({ monitors: [w.monitors.get('m1')], repo: w.repo, checkRegion: w.checkRegion, sendEmail: w.sendEmail, now });
  const m = w.monitors.get('m1');
  assert.equal(m.nextCheckAt.getTime(), now + 120_000);
});

test('pipeline: monitors without alert contacts never trigger email', async () => {
  const w = makeWorld();
  w.monitors.set('m1', mkMonitor({ alertContacts: [], _forceStatus: 'down', alertAfterFailures: 1 }));
  await runAll({ monitors: [w.monitors.get('m1')], repo: w.repo, checkRegion: w.checkRegion, sendEmail: w.sendEmail });
  assert.equal(w.emails.length, 0);
  assert.equal(w.incidents.length, 1, 'incident still recorded');
});
