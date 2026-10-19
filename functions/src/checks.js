'use strict';
// Server-side port of the 8 deep checks. Direct fetch (no CORS proxy),
// node:tls for real certificate data, node:dns for resolution.
const tls = require('node:tls');
const dns = require('node:dns').promises;
const { URL } = require('node:url');

const ERROR_INDICATORS = ['404 not found', '500 internal server error', 'service unavailable', 'access denied', 'forbidden', 'under maintenance', 'coming soon', 'error 503', 'bad gateway', 'gateway timeout'];

async function runConnectivityCheck(url, timeout) {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(timeout), redirect: 'follow' });
    return { passed: true, responseTimeMs: Date.now() - start, statusCode: res.status, error: null };
  } catch (e) {
    return { passed: false, responseTimeMs: Date.now() - start, statusCode: null, error: isTimeout(e) ? 'Timeout' : e.message };
  }
}

async function runFullLoadCheck(url, timeout, monitor) {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: monitor.method || 'GET',
      headers: monitor.headers || {},
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    });
    const text = await response.text();
    const responseTime = Date.now() - start;
    let passed = response.ok;
    let error = null;
    if (monitor.expectedStatusCode && response.status !== monitor.expectedStatusCode) {
      passed = false;
      error = 'Expected ' + monitor.expectedStatusCode + ', got ' + response.status;
    }
    return { passed, responseTimeMs: responseTime, responseSizeBytes: Buffer.byteLength(text), statusCode: response.status, error, responseBody: text };
  } catch (e) {
    return { passed: false, responseTimeMs: Date.now() - start, responseSizeBytes: 0, statusCode: null, error: isTimeout(e) ? 'Timeout' : e.message, responseBody: '' };
  }
}

function validateContent(responseBody) {
  if (!responseBody || !responseBody.trim()) return { passed: false, issues: ['Empty response body'] };
  const issues = [];
  const lower = responseBody.toLowerCase();
  const hasHtml = lower.includes('<html') && lower.includes('<body');
  const trimmed = responseBody.trim();
  const hasJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  let htmlValid = lower.includes('<!doctype html') || hasHtml;
  let jsonValid = false;
  if (hasJson) { try { JSON.parse(responseBody); jsonValid = true; } catch { /* not json */ } }
  if (!htmlValid && !jsonValid && !lower.includes('<!doctype')) issues.push('Response does not appear to be valid HTML or JSON');
  const titleMatch = responseBody.match(/<title[^>]*>([^<]+)<\/title>/i);
  const hasTitle = !!(titleMatch && titleMatch[1] && titleMatch[1].trim());
  if (htmlValid && !hasTitle) issues.push('Page has no title tag');
  for (const indicator of ERROR_INDICATORS) {
    if (lower.includes(indicator)) { issues.push('Error page indicator detected: "' + indicator + '"'); break; }
  }
  return { passed: issues.length === 0, issues, htmlValid, jsonValid, hasTitle };
}

function extractInternalLinks(baseUrl, responseBody) {
  const domain = new URL(baseUrl).hostname;
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  const matches = responseBody.match(linkRegex) || [];
  const internal = [];
  matches.forEach((m) => {
    const match = m.match(/href=["'](https?:\/\/[^"']+)["']/);
    if (match && match[1] && match[1].includes(domain)) internal.push(match[1]);
  });
  return [...new Set(internal)].slice(0, 10);
}

async function runLinkValidationCheck(baseUrl, responseBody, timeout) {
  const uniqueLinks = extractInternalLinks(baseUrl, responseBody || '');
  if (uniqueLinks.length === 0) return { checked: 0, broken: 0, brokenUrls: [], passRatio: 1 };
  const brokenUrls = [];
  for (const link of uniqueLinks) {
    try {
      const res = await fetch(link, { method: 'HEAD', signal: AbortSignal.timeout(Math.max(1000, timeout / uniqueLinks.length)), redirect: 'follow' });
      if (res.status >= 400) brokenUrls.push(link);
    } catch { brokenUrls.push(link); }
  }
  const broken = brokenUrls.length;
  const checked = uniqueLinks.length;
  return { checked, broken, brokenUrls, passRatio: (checked - broken) / checked };
}

function runSSLCheck(url) {
  const hostname = new URL(url).hostname;
  return new Promise((resolve) => {
    if (!url.startsWith('https://')) {
      return resolve({ valid: false, daysUntilExpiry: null, issuer: null, error: 'Not an HTTPS URL' });
    }
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: false, timeout: 10000 }, () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.end();
          if (!cert || !cert.valid_to) return done({ valid: null, daysUntilExpiry: null, issuer: null, error: 'No certificate presented' });
          const validTo = new Date(cert.valid_to);
          const daysUntilExpiry = Math.floor((validTo.getTime() - Date.now()) / 86400000);
          done({ valid: daysUntilExpiry > 0, daysUntilExpiry, issuer: cert.issuer ? (cert.issuer.O || String(cert.issuer)) : null, error: daysUntilExpiry > 0 ? null : 'Certificate expired' });
        } catch (e) { done({ valid: null, daysUntilExpiry: null, issuer: null, error: e.message }); }
      });
      socket.on('error', (e) => done({ valid: null, daysUntilExpiry: null, issuer: null, error: 'TLS error: ' + e.message }));
      socket.on('timeout', () => { socket.destroy(); done({ valid: null, daysUntilExpiry: null, issuer: null, error: 'Timeout' }); });
    } catch (e) {
      done({ valid: null, daysUntilExpiry: null, issuer: null, error: e.message });
    }
  });
}

async function runDNSCheck(url) {
  const start = Date.now();
  const hostname = new URL(url).hostname;
  try {
    const records = await dns.lookup(hostname, { family: 4 });
    return { resolved: true, resolutionTimeMs: Date.now() - start, ipAddress: records.address, error: null };
  } catch (e) {
    return { resolved: false, resolutionTimeMs: Date.now() - start, ipAddress: null, error: e.message || 'DNS resolution failed' };
  }
}

async function runRedirectCheck(url, timeout) {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    const chain = [url];
    const location = response.headers.get('location');
    if (location) chain.push(new URL(location, url).toString());
    const https = url.startsWith('https://');
    const httpsRedirect = !https && response.status >= 300 && response.status < 400 && (location || '').startsWith('https');
    return { chain, finalUrl: chain[chain.length - 1], hopCount: chain.length, isHttps: https || !!httpsRedirect };
  } catch {
    return { chain: [url], finalUrl: url, hopCount: 0, isHttps: url.startsWith('https://') };
  }
}

function calculatePerformanceScore(checks) {
  let score = 0;
  const { connectivity, fullLoad, ssl, linkValidation, dns } = checks;
  if (fullLoad && fullLoad.responseTimeMs < 200) score += 25;
  else if (fullLoad && fullLoad.responseTimeMs < 500) score += 15;
  else if (fullLoad && fullLoad.responseTimeMs < 1000) score += 5;
  if (ssl && ssl.valid === true && ssl.daysUntilExpiry > 30) score += 20;
  else if (ssl && ssl.valid === true) score += 10;
  if (linkValidation && linkValidation.passRatio >= 0.7) score += 20;
  if (checks.contentValidation && checks.contentValidation.passed) score += 20;
  if (dns && dns.resolutionTimeMs < 50) score += 15;
  else if (dns && dns.resolved) score += 5;
  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 40) grade = 'D';
  return { score, grade };
}

function calculateOverallStatus(checks) {
  const { connectivity, fullLoad, contentValidation, ssl, linkValidation } = checks;
  if ((connectivity && connectivity.error === 'Timeout') || (fullLoad && fullLoad.error === 'Timeout')) return 'down';
  if (!connectivity || !connectivity.passed || !fullLoad || !fullLoad.passed) return 'down';
  if (contentValidation && contentValidation.issues && contentValidation.issues.some((i) => ERROR_INDICATORS.some((e) => i.toLowerCase().includes(e)))) return 'degraded';
  if (ssl && ssl.daysUntilExpiry != null && ssl.daysUntilExpiry < 7) return 'critical_warning';
  if (ssl && ssl.daysUntilExpiry != null && ssl.daysUntilExpiry < 30) return 'warning';
  if (linkValidation && linkValidation.passRatio < 0.7) return 'degraded';
  if (fullLoad && fullLoad.responseTimeMs > 1000) return 'slow';
  return 'up';
}

function isTimeout(e) {
  return e && (e.name === 'TimeoutError' || e.name === 'AbortError' || /timeout/i.test(e.message || ''));
}

// Run all checks for one monitor in one region. Same result shape the UI expects.
async function checkMonitor(monitor, regionId, locationInfo) {
  const timeout = monitor.timeoutSeconds ? monitor.timeoutSeconds * 1000 : 15000;
  const checks = { connectivity: null, fullLoad: null, contentValidation: null, linkValidation: null, ssl: null, dns: null, redirects: null, performance: null };
  try {
    checks.connectivity = await runConnectivityCheck(monitor.url, timeout);
    checks.fullLoad = await runFullLoadCheck(monitor.url, timeout, monitor);
    if (checks.fullLoad && checks.fullLoad.responseBody) {
      checks.contentValidation = validateContent(checks.fullLoad.responseBody);
      checks.linkValidation = await runLinkValidationCheck(monitor.url, checks.fullLoad.responseBody, timeout);
    }
    checks.ssl = await runSSLCheck(monitor.url);
    checks.dns = await runDNSCheck(monitor.url);
    checks.redirects = await runRedirectCheck(monitor.url, timeout);
    checks.performance = calculatePerformanceScore(checks);
  } catch (e) {
    console.error('Check error', monitor.url, e);
  }
  const status = calculateOverallStatus(checks);
  return {
    passed: status === 'up',
    status,
    responseTimeMs: (checks.fullLoad && checks.fullLoad.responseTimeMs) || (checks.connectivity && checks.connectivity.responseTimeMs) || 0,
    checks,
    locationInfo: locationInfo || null,
    expectedStatus: monitor.expectedStatusCode,
    location: regionId,
  };
}

module.exports = {
  ERROR_INDICATORS,
  runConnectivityCheck,
  runFullLoadCheck,
  validateContent,
  extractInternalLinks,
  runLinkValidationCheck,
  runSSLCheck,
  runDNSCheck,
  runRedirectCheck,
  calculatePerformanceScore,
  calculateOverallStatus,
  checkMonitor,
};
