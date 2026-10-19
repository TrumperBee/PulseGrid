'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core');

const R = (status, responseTimeMs = 100) => ({ status, responseTimeMs, checks: {} });
const MON = (over = {}) => ({
  id: 'm1', name: 'API', url: 'https://example.com', status: 'up',
  alertAfterFailures: 3, consecutiveFailures: 0, intervalSeconds: 300, ...over,
});

test('computeUptime: null with no history, correct math with history', () => {
  assert.equal(core.computeUptime(0, 0), null);
  assert.equal(core.computeUptime(undefined, undefined), null);
  assert.equal(core.computeUptime(4, 3), 75);
  assert.equal(core.computeUptime(3, 3), 100); // 100% only when checks support it
  assert.equal(core.computeUptime(7, 6), 85.71);
});

test('aggregateStatus takes the worst region status', () => {
  assert.equal(core.aggregateStatus({ a: R('up'), b: R('slow') }), 'slow');
  assert.equal(core.aggregateStatus({ a: R('slow'), b: R('down') }), 'down');
  assert.equal(core.aggregateStatus({ a: R('up') }), 'up');
  assert.equal(core.aggregateStatus({}), 'up');
});

test('selectDueMonitors skips paused, inactive and not-yet-due monitors', () => {
  const now = 1_000_000;
  const monitors = [
    MON({ id: 'due', nextCheckAt: new Date(now - 1) }),
    MON({ id: 'notdue', nextCheckAt: new Date(now + 60_000) }),
    MON({ id: 'paused', isPaused: true, nextCheckAt: new Date(now - 1) }),
    MON({ id: 'inactive', isActive: false }),
    MON({ id: 'fresh' }), // no nextCheckAt → due immediately
  ];
  const ids = core.selectDueMonitors(monitors, now).map((m) => m.id);
  assert.deepEqual(ids.sort(), ['due', 'fresh']);
});

test('nextCheckAtMs honors intervalSeconds with a 30s floor', () => {
  assert.equal(core.nextCheckAtMs(1000, 300), 1000 + 300_000);
  assert.equal(core.nextCheckAtMs(1000, 5), 1000 + 30_000);
  assert.equal(core.nextCheckAtMs(1000, undefined), 1000 + 300_000);
});

test('evaluateMonitor: no incident before threshold, incident at threshold, alert once', () => {
  let monitor = MON();
  const down = { nairobi: R('down') };
  // failures 1 and 2 → degraded, no incident, no alert
  for (let i = 1; i <= 2; i++) {
    const a = core.evaluateMonitor({ monitor, regionResults: down, openIncidents: [] });
    assert.equal(a.status, 'degraded');
    assert.equal(a.createIncident, false);
    assert.equal(a.alert, null);
    assert.equal(a.consecutiveFailures, i);
    monitor = { ...monitor, status: a.status, consecutiveFailures: a.consecutiveFailures };
  }
  // failure 3 → down + incident + alert
  const a3 = core.evaluateMonitor({ monitor, regionResults: down, openIncidents: [] });
  assert.equal(a3.status, 'down');
  assert.equal(a3.createIncident, true);
  assert.equal(a3.alert, 'down');
  // failure 4 with an open incident → no duplicate incident, no duplicate alert
  monitor = { ...monitor, status: 'down', consecutiveFailures: 3, lastDownAlertAt: Date.now() };
  const a4 = core.evaluateMonitor({ monitor, regionResults: down, openIncidents: [{ id: 'inc-1' }] });
  assert.equal(a4.status, 'down');
  assert.equal(a4.createIncident, false);
  assert.equal(a4.alert, null);
});

test('evaluateMonitor: recovery resolves open incidents and alerts once', () => {
  const monitor = MON({ status: 'down', consecutiveFailures: 5 });
  const up = { nairobi: R('up') };
  const a = core.evaluateMonitor({ monitor, regionResults: up, openIncidents: [{ id: 'inc-1' }, { id: 'inc-2' }] });
  assert.equal(a.status, 'up');
  assert.equal(a.consecutiveFailures, 0);
  assert.deepEqual(a.resolveIncidentIds, ['inc-1', 'inc-2']);
  assert.equal(a.alert, 'recovered');
  // second healthy run: nothing left to resolve, no alert
  const a2 = core.evaluateMonitor({ monitor: { ...monitor, status: 'up' }, regionResults: up, openIncidents: [] });
  assert.deepEqual(a2.resolveIncidentIds, []);
  assert.equal(a2.alert, null);
});

test('evaluateMonitor: alert suppression window prevents rapid duplicate emails', () => {
  const now = Date.now();
  const monitor = MON({ status: 'up', consecutiveFailures: 2, lastDownAlertAt: now - 60_000 }); // 3rd failure, alert 1 min ago
  const a = core.evaluateMonitor({ monitor, regionResults: { nairobi: R('down') }, openIncidents: [], now });
  assert.equal(a.status, 'down');
  assert.equal(a.createIncident, true); // incident still created
  assert.equal(a.alert, null); // but email suppressed (within 15 min)
});

test('evaluateMonitor: alertAfterFailures=1 alerts on first failure', () => {
  const monitor = MON({ alertAfterFailures: 1 });
  const a = core.evaluateMonitor({ monitor, regionResults: { nairobi: R('down') }, openIncidents: [] });
  assert.equal(a.status, 'down');
  assert.equal(a.createIncident, true);
  assert.equal(a.alert, 'down');
});

test('generateIncidentDescription produces plain-English timeout text', () => {
  const desc = core.generateIncidentDescription('My API', {
    status: 'down',
    responseTimeMs: 30000,
    checks: { connectivity: { error: 'Timeout' }, fullLoad: { error: 'Timeout' } },
    locationInfo: { name: 'Nairobi, Kenya', region: 'Africa' },
  }, 200);
  assert.match(desc.title, /unreachable from Nairobi/);
  assert.equal(desc.type, 'timeout');
});

test('alert email html escapes monitor data', () => {
  const html = core.buildAlertEmailHtml({
    monitor: { name: '<script>x</script>', url: 'https://e.com' },
    eventType: 'down', description: '<b>bad</b>', checks: null,
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
