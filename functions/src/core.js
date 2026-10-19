'use strict';
// Pure logic — no network, no Firebase. Unit-tested in functions/test/core.test.js.

const STATUS_SEVERITY = { up: 0, pending: 0, slow: 1, warning: 2, degraded: 3, critical_warning: 4, down: 5 };
const ALERT_SUPPRESS_MS = 15 * 60 * 1000;

const LOCATION_NAMES = {
  nairobi: { name: 'Nairobi, Kenya', region: 'Africa', country: 'KE' },
  frankfurt: { name: 'Frankfurt, Germany', region: 'Europe', country: 'DE' },
  newyork: { name: 'New York, USA', region: 'North America', country: 'US' },
  london: { name: 'London, UK', region: 'Europe', country: 'GB' },
  singapore: { name: 'Singapore', region: 'Asia', country: 'SG' },
  tokyo: { name: 'Tokyo, Japan', region: 'Asia', country: 'JP' },
  sydney: { name: 'Sydney, Australia', region: 'Oceania', country: 'AU' },
  saopaulo: { name: 'São Paulo, Brazil', region: 'South America', country: 'BR' },
  mumbai: { name: 'Mumbai, India', region: 'Asia', country: 'IN' },
  dubai: { name: 'Dubai, UAE', region: 'Middle East', country: 'AE' },
  amsterdam: { name: 'Amsterdam, Netherlands', region: 'Europe', country: 'NL' },
  toronto: { name: 'Toronto, Canada', region: 'North America', country: 'CA' },
};

function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Worst status across regions wins.
function aggregateStatus(regionResults) {
  let worst = 'up';
  for (const r of Object.values(regionResults || {})) {
    const s = r && r.status;
    if (s && (STATUS_SEVERITY[s] ?? 0) > (STATUS_SEVERITY[worst] ?? 0)) worst = s;
  }
  return worst;
}

// Uptime is null (unknown) until at least one genuine check has been recorded.
function computeUptime(total, passed) {
  if (!total || total <= 0) return null;
  return Math.round((passed / total) * 10000) / 100;
}

function selectDueMonitors(monitors, now = Date.now()) {
  return (monitors || []).filter((m) => {
    if (m.isActive === false) return false;
    if (m.isPaused) return false;
    return !m.nextCheckAt || toMs(m.nextCheckAt) <= now;
  });
}

function nextCheckAtMs(now, intervalSeconds) {
  const iv = Math.max(30, Number(intervalSeconds) || 300);
  return now + iv * 1000;
}

// Incident/alert state machine.
// Inputs: stored monitor, per-region results, open incidents, clock.
// Output: { status, consecutiveFailures, createIncident, resolveIncidentIds, alert }
function evaluateMonitor({ monitor, regionResults, openIncidents = [], now = Date.now() }) {
  const aggregate = aggregateStatus(regionResults);
  const failing = aggregate === 'down';
  const threshold = Math.max(1, Number(monitor.alertAfterFailures) || 3);
  const prevFailures = Number(monitor.consecutiveFailures) || 0;
  const consecutiveFailures = failing ? prevFailures + 1 : 0;
  const wasDown = monitor.status === 'down';

  let status;
  if (failing) status = consecutiveFailures >= threshold ? 'down' : 'degraded';
  else status = aggregate;

  const enteredDown = status === 'down' && !wasDown;
  const recovered = !failing && wasDown;

  const actions = { status, consecutiveFailures, createIncident: false, resolveIncidentIds: [], alert: null };

  if (enteredDown) {
    // Duplicate prevention: never open a second incident for the same outage.
    if (openIncidents.length === 0) actions.createIncident = true;
    const last = toMs(monitor.lastDownAlertAt);
    if (!last || now - last >= ALERT_SUPPRESS_MS) actions.alert = 'down';
  }
  if (recovered) {
    actions.resolveIncidentIds = openIncidents.map((i) => i.id);
    const last = toMs(monitor.lastRecoveryAlertAt);
    if (openIncidents.length > 0 && (!last || now - last >= ALERT_SUPPRESS_MS)) actions.alert = 'recovered';
  }
  return actions;
}

function worstFailingRegion(regionResults) {
  const entries = Object.entries(regionResults || {}).filter(([, r]) => r && r.status === 'down');
  entries.sort((a, b) => (a[1].responseTimeMs || 0) - (b[1].responseTimeMs || 0));
  return entries[0] || null;
}

function regionNameList(regionResults, pass) {
  return Object.entries(regionResults || {})
    .filter(([, r]) => (pass ? r && r.status !== 'down' : !r || r.status === 'down'))
    .map(([id]) => (LOCATION_NAMES[id] && LOCATION_NAMES[id].name) || id)
    .join(', ');
}

// Ported verbatim in behavior from the original client generateIncidentDescription.
function generateIncidentDescription(monitorName, regionResult, expectedStatus) {
  const c = (regionResult && regionResult.checks) || {};
  const locationInfo = (regionResult && regionResult.locationInfo) || {};
  const locName = locationInfo.name || 'a monitoring location';
  const errors = [];
  if (c.connectivity && c.connectivity.error) errors.push('connectivity: ' + c.connectivity.error);
  if (c.fullLoad && c.fullLoad.error) errors.push('load: ' + c.fullLoad.error);
  if (c.dns && c.dns.error) errors.push('dns: ' + c.dns.error);
  if (c.contentValidation && c.contentValidation.issues && c.contentValidation.issues.length) errors.push('content: ' + c.contentValidation.issues.join('; '));
  if (c.linkValidation && c.linkValidation.broken > 0) errors.push('broken links: ' + c.linkValidation.broken + ' of ' + c.linkValidation.checked);
  if (c.ssl && c.ssl.error) errors.push('ssl: ' + c.ssl.error);
  if (c.ssl && c.ssl.daysUntilExpiry != null && c.ssl.daysUntilExpiry < 30) errors.push('ssl expiring in ' + c.ssl.daysUntilExpiry + ' days');
  const error = errors.join('; ') || 'Unknown error';

  if ((c.connectivity && c.connectivity.error === 'Timeout') || (c.fullLoad && c.fullLoad.error === 'Timeout')) {
    return {
      title: monitorName + ' is unreachable from ' + locName,
      description: monitorName + ' is completely unreachable from ' + locName + '. The server is not responding to any requests. Technical: connection timed out — no response received.',
      type: 'timeout',
    };
  }
  if (c.dns && c.dns.error) {
    return {
      title: monitorName + ' domain not found from ' + locName,
      description: monitorName + ' cannot be found from ' + locName + '. The domain name is not resolving to an IP address. This could mean the domain has expired or DNS is misconfigured. Technical: DNS lookup failed — ' + c.dns.error,
      type: 'dns',
    };
  }
  if (c.fullLoad && c.fullLoad.statusCode && c.fullLoad.statusCode >= 400) {
    const explanations = { 401: 'Authentication required', 403: 'Access forbidden', 404: 'Page not found', 500: 'Server crashed', 502: 'Bad gateway', 503: 'Service unavailable' };
    return {
      title: monitorName + ' returning HTTP ' + c.fullLoad.statusCode + ' from ' + locName,
      description: monitorName + ' is returning an error page from ' + locName + '. The server responded with HTTP ' + c.fullLoad.statusCode + ' instead of ' + (expectedStatus || 200) + '. ' + (explanations[c.fullLoad.statusCode] || 'Server error') + '. Technical: expected ' + (expectedStatus || 200) + ', received ' + c.fullLoad.statusCode,
      type: 'http_error',
    };
  }
  if (c.contentValidation && c.contentValidation.issues && c.contentValidation.issues.length) {
    return {
      title: monitorName + ' content issues from ' + locName,
      description: monitorName + ' is loading but has content issues from ' + locName + '. Failed validation: ' + c.contentValidation.issues.join('; '),
      type: 'content',
    };
  }
  if (c.linkValidation && c.linkValidation.broken > 0) {
    return {
      title: monitorName + ' has broken pages from ' + locName,
      description: monitorName + ' has broken internal pages from ' + locName + '. ' + c.linkValidation.broken + ' of ' + c.linkValidation.checked + ' links are failing. Affected: ' + (c.linkValidation.brokenUrls || []).slice(0, 3).join(', '),
      type: 'links',
    };
  }
  if (c.ssl && c.ssl.daysUntilExpiry != null && c.ssl.daysUntilExpiry < 30) {
    return {
      title: monitorName + ' SSL certificate ' + (c.ssl.daysUntilExpiry < 7 ? 'expired' : 'expiring soon'),
      description: monitorName + ' has an SSL certificate problem (' + (c.ssl.daysUntilExpiry < 7 ? 'expired' : 'expires in ' + c.ssl.daysUntilExpiry + ' days') + '). Users will see security warnings. Issuer: ' + (c.ssl.issuer || 'unknown'),
      type: 'ssl',
    };
  }
  return {
    title: monitorName + ' ' + error + ' from ' + locName,
    description: monitorName + ' has an issue from ' + locName + ': ' + error + '. Technical: ' + error,
    type: 'unknown',
  };
}

function checksSummaryHtml(checks) {
  const failed = [];
  const passed = [];
  if (!checks) return '';
  if (checks.connectivity && checks.connectivity.passed === false) failed.push('Connectivity — ' + (checks.connectivity.error || 'Failed'));
  if (checks.fullLoad && checks.fullLoad.passed === false) failed.push('Full Page Load — ' + (checks.fullLoad.error || 'Failed'));
  if (checks.contentValidation && checks.contentValidation.passed === false) failed.push('Content — ' + ((checks.contentValidation.issues || []).join('; ') || 'Failed'));
  if (checks.linkValidation && checks.linkValidation.broken > 0) failed.push('Links — ' + checks.linkValidation.broken + ' of ' + checks.linkValidation.checked + ' broken');
  if (checks.ssl && (checks.ssl.valid === false || (checks.ssl.daysUntilExpiry != null && checks.ssl.daysUntilExpiry < 30))) failed.push('SSL — ' + (checks.ssl.daysUntilExpiry != null && checks.ssl.daysUntilExpiry < 30 ? 'Expiring in ' + checks.ssl.daysUntilExpiry + ' days' : 'Invalid'));
  if (checks.dns && checks.dns.resolved === false) failed.push('DNS — ' + (checks.dns.error || 'Failed'));
  if (checks.connectivity && checks.connectivity.passed !== false) passed.push('Connectivity');
  if (checks.fullLoad && checks.fullLoad.passed !== false) passed.push('Full Page Load');
  if (checks.contentValidation && checks.contentValidation.passed !== false) passed.push('Content');
  if (checks.linkValidation && !(checks.linkValidation.broken > 0)) passed.push('Links');
  if (checks.ssl && checks.ssl.valid !== false && !(checks.ssl.daysUntilExpiry != null && checks.ssl.daysUntilExpiry < 30)) passed.push('SSL');
  if (checks.dns && checks.dns.resolved !== false) passed.push('DNS');
  let html = '';
  if (failed.length || passed.length) {
    html = '<div style="margin-top:20px;"><h3 style="color:#E8E8F0;">Check Results</h3>';
    failed.forEach((f) => { html += '<div style="color:#ff6b6b;padding:3px 0;">❌ ' + escapeHtml(f) + '</div>'; });
    passed.forEach((p) => { html += '<div style="color:#6b6;padding:3px 0;">✅ ' + escapeHtml(p) + '</div>'; });
    html += '</div>';
  }
  return html;
}

function buildAlertEmailHtml({ monitor, eventType, description, affectedLocations, workingLocations, checks }) {
  const down = eventType === 'down';
  return '<div style="font-family:Arial,sans-serif;background:#050508;color:#E8E8F0;padding:20px;">' +
    '<div style="max-width:600px;margin:0 auto;background:#0D0D18;border-radius:12px;padding:30px;">' +
    '<h1 style="color:' + (down ? '#ff6b6b' : '#6b6') + ';">' + (down ? '🚨 Monitor Down!' : '✅ Monitor Recovered!') + '</h1>' +
    (description ? '<p style="color:#E8E8F0;margin-top:15px;font-size:16px;">' + escapeHtml(description) + '</p>' : '') +
    '<p style="margin-top:15px;"><strong>Monitor:</strong> ' + escapeHtml(monitor.name) + '</p>' +
    '<p><strong>URL:</strong> ' + escapeHtml(monitor.url) + '</p>' +
    '<p><strong>Time:</strong> ' + new Date().toLocaleString() + '</p>' +
    (affectedLocations ? '<p><strong>Affected locations:</strong> <span style="color:#ff6b6b;">' + escapeHtml(affectedLocations) + '</span></p>' : '') +
    (workingLocations ? '<p><strong>Working locations:</strong> <span style="color:#6b6;">' + escapeHtml(workingLocations) + '</span></p>' : '') +
    checksSummaryHtml(checks) +
    '<a href="https://pulsegrid.vercel.app" style="display:inline-block;background:#00F5FF;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:20px;">View in PulseGrid</a>' +
    '</div></div>';
}

function buildReportEmailHtml({ periodLabel, monitors }) {
  const rows = monitors.map((m) => {
    const uptime = m.uptimePercentage != null ? m.uptimePercentage.toFixed(2) + '%' : 'No data yet';
    const status = m.status === 'down' ? 'DOWN' : (m.status || 'pending') === 'pending' ? 'NOT YET CHECKED' : 'UP';
    const color = m.status === 'down' ? '#FF3366' : '#39FF14';
    return '<tr><td style="padding:8px;border-bottom:1px solid #1A1A2E;">' + escapeHtml(m.name) + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #1A1A2E;color:' + color + ';">' + status + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #1A1A2E;">' + uptime + '</td></tr>';
  }).join('');
  return '<div style="font-family:Arial,sans-serif;background:#050508;color:#E8E8F0;padding:20px;">' +
    '<div style="max-width:600px;margin:0 auto;background:#0D0D18;border-radius:12px;padding:30px;">' +
    '<h1 style="color:#00F5FF;margin-bottom:20px;">PulseGrid ' + escapeHtml(periodLabel) + '</h1>' +
    '<p>' + monitors.length + ' monitor(s). Uptime is calculated from recorded checks only; "No data yet" means no checks have run.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<tr style="background:#1A1A2E;"><th style="padding:8px;text-align:left;">Name</th><th style="padding:8px;text-align:left;">Status</th><th style="padding:8px;text-align:left;">Uptime</th></tr>' +
    rows +
    '</table>' +
    '<p style="color:#666;font-size:11px;margin-top:20px;">Generated by PulseGrid on ' + new Date().toLocaleString() + '</p>' +
    '</div></div>';
}

module.exports = {
  LOCATION_NAMES,
  STATUS_SEVERITY,
  ALERT_SUPPRESS_MS,
  toMs,
  escapeHtml,
  aggregateStatus,
  computeUptime,
  selectDueMonitors,
  nextCheckAtMs,
  evaluateMonitor,
  worstFailingRegion,
  regionNameList,
  generateIncidentDescription,
  buildAlertEmailHtml,
  buildReportEmailHtml,
};
