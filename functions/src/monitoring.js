'use strict';
// Orchestrator: runs checks, applies the incident state machine, persists results.
// All external effects go through injected deps (repo, checkRegion, sendEmail)
// so the whole pipeline is unit-testable without network or Firebase.
const core = require('./core');

async function processMonitor({ monitor, repo, checkRegion, sendEmail, now = Date.now() }) {
  const regionIds = (monitor.locations && monitor.locations.length ? monitor.locations : ['nairobi']);
  const regionResults = {};
  await Promise.all(regionIds.map(async (regionId) => {
    regionResults[regionId] = await checkRegion(monitor, regionId, core.LOCATION_NAMES[regionId]);
  }));

  const openIncidents = await repo.getOpenIncidents(monitor.id);
  const actions = core.evaluateMonitor({ monitor, regionResults, openIncidents, now });

  let total = 0;
  let passedCount = 0;
  let responseSum = 0;
  let responseN = 0;
  let lastError = null;
  for (const r of Object.values(regionResults)) {
    if (!r) continue;
    total++;
    if (r.status !== 'down') passedCount++;
    if (r.responseTimeMs) { responseSum += r.responseTimeMs; responseN++; }
    if (!lastError && r.status === 'down') {
      lastError = (r.checks && ((r.checks.fullLoad && r.checks.fullLoad.error) || (r.checks.connectivity && r.checks.connectivity.error))) || 'Check failed';
    }
  }
  const avgResponseMs = responseN > 0 ? Math.round(responseSum / responseN) : 0;

  // Incident creation (plain-English, from the worst failing region)
  let incidentDesc = null;
  if (actions.createIncident) {
    const worst = core.worstFailingRegion(regionResults) || [regionIds[0], regionResults[regionIds[0]]];
    incidentDesc = core.generateIncidentDescription(monitor.name, worst[1], monitor.expectedStatusCode);
    await repo.createIncident({
      monitorId: monitor.id,
      monitorName: monitor.name,
      userId: monitor.userId,
      title: incidentDesc.title,
      description: incidentDesc.description,
      incidentType: incidentDesc.type,
      isResolved: false,
      affectedLocations: core.regionNameList(regionResults, false),
      workingLocations: core.regionNameList(regionResults, true),
      checkResults: regionResults,
      timeline: [{ time: new Date(now).toISOString(), event: 'Incident created', detail: 'Failure threshold reached (' + (Math.max(1, Number(monitor.alertAfterFailures) || 3)) + ' consecutive failed checks)' }],
    });
  }

  for (const incidentId of actions.resolveIncidentIds) {
    await repo.resolveIncident(incidentId, {
      timeline: [{ time: new Date(now).toISOString(), event: 'Recovered', detail: 'Service responding again; monitor recovered' }],
    });
  }

  // Alerts only on state transitions, with suppression window (see core.evaluateMonitor).
  if (actions.alert && Array.isArray(monitor.alertContacts) && monitor.alertContacts.length > 0 && typeof sendEmail === 'function') {
    const failedRegion = core.worstFailingRegion(regionResults);
    const desc = actions.alert === 'down'
      ? (incidentDesc || core.generateIncidentDescription(monitor.name, failedRegion ? failedRegion[1] : null, monitor.expectedStatusCode))
      : { description: monitor.name + ' is responding normally again in ' + (core.regionNameList(regionResults, true) || 'all locations') + ' after being down.' };
    const subject = actions.alert === 'down'
      ? '🚨 ' + monitor.name + ' is DOWN — PulseGrid Alert'
      : '✅ ' + monitor.name + ' recovered — PulseGrid Alert';
    try {
      await sendEmail({
        to: monitor.alertContacts,
        subject,
        html: core.buildAlertEmailHtml({
          monitor,
          eventType: actions.alert,
          description: desc.description,
          affectedLocations: actions.alert === 'down' ? core.regionNameList(regionResults, false) : undefined,
          workingLocations: core.regionNameList(regionResults, true),
          checks: failedRegion ? failedRegion[1].checks : null,
        }),
        from: 'PulseGrid Alerts <alerts@resend.dev>',
      });
    } catch (e) {
      console.error('Alert email failed for', monitor.id, e.message);
    }
  }

  const newTotal = (Number(monitor.uptimeChecksTotal) || 0) + total;
  const newPassed = (Number(monitor.uptimeChecksPassed) || 0) + passedCount;
  const historyEntry = { time: new Date(now).toISOString(), status: actions.status, responseTimeMs: avgResponseMs, regions: regionResults };
  const updates = {
    status: actions.status,
    avgResponseMs,
    lastError,
    consecutiveFailures: actions.consecutiveFailures,
    nextCheckAt: new Date(core.nextCheckAtMs(now, monitor.intervalSeconds)),
    checkHistory: [...(monitor.checkHistory || []).slice(-47), historyEntry],
    uptimeChecksTotal: newTotal,
    uptimeChecksPassed: newPassed,
    uptimePercentage: core.computeUptime(newTotal, newPassed),
  };
  if (actions.alert === 'down') updates.lastDownAlertAt = new Date(now);
  if (actions.alert === 'recovered') updates.lastRecoveryAlertAt = new Date(now);
  await repo.updateMonitor(monitor.id, updates);

  return { monitorId: monitor.id, name: monitor.name, status: actions.status, responseTimeMs: avgResponseMs, alert: actions.alert };
}

// Run a set of monitors. Returns { checked, down, avgResponseMs, results }.
async function runAll({ monitors, repo, checkRegion, sendEmail, now = Date.now() }) {
  const results = [];
  let down = 0;
  let responseSum = 0;
  for (const monitor of monitors) {
    try {
      const r = await processMonitor({ monitor, repo, checkRegion, sendEmail, now });
      results.push(r);
      if (r.status === 'down') down++;
      responseSum += r.responseTimeMs || 0;
    } catch (e) {
      console.error('Failed processing monitor', monitor.id, e);
      results.push({ monitorId: monitor.id, error: e.message });
    }
  }
  return {
    checked: monitors.length,
    down,
    avgResponseMs: monitors.length > 0 ? Math.round(responseSum / monitors.length) : 0,
    results,
  };
}

module.exports = { processMonitor, runAll };
