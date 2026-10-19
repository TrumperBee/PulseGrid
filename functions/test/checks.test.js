'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateContent, extractInternalLinks, calculatePerformanceScore, calculateOverallStatus } = require('../src/checks');

test('validateContent: empty body fails', () => {
  const r = validateContent('');
  assert.equal(r.passed, false);
  assert.ok(r.issues.includes('Empty response body'));
});

test('validateContent: valid HTML page with title passes', () => {
  const r = validateContent('<!DOCTYPE html><html><head><title>eHub Market</title></head><body>ok</body></html>');
  assert.equal(r.passed, true);
  assert.equal(r.hasTitle, true);
});

test('validateContent: detects error-page indicators', () => {
  const r = validateContent('<html><head><title>x</title></head><body>Service Unavailable</body></html>');
  assert.equal(r.passed, false);
  assert.ok(r.issues.some((i) => i.includes('Error page indicator')));
});

test('validateContent: valid JSON passes', () => {
  const r = validateContent('{"status":"ok"}');
  assert.equal(r.passed, true);
  assert.equal(r.jsonValid, true);
});

test('extractInternalLinks: only same-domain absolute links, deduped, max 10', () => {
  const body = Array.from({ length: 15 }, (_, i) => `<a href="https://example.com/p${i}">x</a>`).join('') +
    '<a href="https://other.com/x">y</a><a href="/relative">z</a>' +
    '<a href="https://example.com/p0">dup</a>';
  const links = extractInternalLinks('https://example.com', body);
  assert.equal(links.length, 10);
  assert.ok(links.every((l) => l.includes('example.com')));
});

test('calculateOverallStatus: timeout → down; slow response → slow; healthy → up', () => {
  assert.equal(calculateOverallStatus({ connectivity: { error: 'Timeout' }, fullLoad: { error: 'Timeout' } }), 'down');
  assert.equal(calculateOverallStatus({ connectivity: { passed: true }, fullLoad: { passed: true, responseTimeMs: 1500 } }), 'slow');
  assert.equal(calculateOverallStatus({ connectivity: { passed: true }, fullLoad: { passed: true, responseTimeMs: 200 }, contentValidation: { passed: true }, ssl: { valid: true, daysUntilExpiry: 200 }, dns: { resolved: true }, linkValidation: { passRatio: 1 } }), 'up');
});

test('calculatePerformanceScore: fast + valid SSL → high grade', () => {
  const r = calculatePerformanceScore({
    fullLoad: { responseTimeMs: 100 },
    ssl: { valid: true, daysUntilExpiry: 200 },
    linkValidation: { passRatio: 1 },
    contentValidation: { passed: true },
    dns: { resolved: true, resolutionTimeMs: 10 },
  });
  assert.equal(r.score, 100);
  assert.equal(r.grade, 'A');
});
