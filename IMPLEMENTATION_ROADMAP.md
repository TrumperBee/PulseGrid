# PulseGrid — Implementation Roadmap

> Date: 2026-10-19 · Branch `main` @ `35cbc1e` (Phase 1 committed)
> Basis: PHASE0_AUDIT.md, current source, Phase 1 implementation, live HTTP probes.
> Rule: a feature is "complete" only when implemented **and** verified where verification is possible locally. Live verification that needs deployment is marked separately.

## Status legend

| Mark | Meaning |
|---|---|
| ✅ | Implemented and covered by local tests or direct code verification |
| 🟡 | Implemented, requires deployment / external config to become live |
| 🔶 | Partially implemented (some paths fake, incomplete, or unsafe) |
| ❌ | Missing or broken |
| ⚪ | Optional (not required for core product) |

---

## A. Deployment status (verified 2026-10-19)

| Item | Evidence | Status |
|---|---|---|
| `https://pulse-grid-eight.vercel.app/` | HTTP 404, `x-vercel-error: DEPLOYMENT_NOT_FOUND` | ❌ No deployment exists for this hostname |
| `https://pulse-grid-seven.vercel.app/` | HTTP 200, **0-byte body on every path** (`/`, `/index.html`, `/app.jsx`, `/styles.css`) | ❌ Project exists but serves nothing |
| `https://pulse-grid.vercel.app/` | 200, different "Welcome to Pulse Grid" crypto landing page | ⚪ Not this application |
| `https://pulsegrid.vercel.app/` | 200, unrelated Vite app | ⚪ Not this application |
| Vercel project linkage locally | No `.vercel/`, no CLI auth, no `VERCEL_TOKEN` | ❓ Cannot inspect dashboard from this machine |
| Repo deployability (static) | `index.html` + `app.jsx` + `styles.css` tracked; CDN dependencies only; `vercel.json` = static, output `.` | ✅ Repo is deployable as-is |
| Deploy hygiene | Added `.vercelignore` so `android/`, `functions/`, `tests/`, internal docs are not published | ✅ Fixed this phase |

**Established:** `DEPLOYMENT_NOT_FOUND` is a platform-level error (no deployment associated with the hostname), not an application runtime error. The previously working hostname was `pulse-grid-seven` (per Phase 0 audit); it was restored (static project: framework Other, output `.`). As of this update it still serves the pre-Phase-1 `app.jsx` until this branch is pushed.

**Outage root cause (2026-10-20):** the deployed Firestore rules were Firebase's default test-mode rules with `request.time < timestamp.date(2026, 5, 16)`. After that date **every** client read/write was denied (`users`, `monitors`, `incidents`, `statusPages`), which is what broke the dashboard, monitors, reports and status pages. The tested owner-only rules were deployed with `firebase deploy --only firestore:rules` and access was restored.

**Map tiles:** The live/pre-Phase-1 map used CARTO basemaps, which now answer tiles with "API KEY required". Tiles were switched to `tile.openstreetmap.org` (no key) with a dark CSS filter and correct attribution.

---

## B. Core product checklist

### 1. Authentication and secure data isolation — ✅ / 🟡
- ✅ Firebase email/password + Google sign-in (web), reset, verification screens.
- ✅ `firestore.rules`: owner-only `users`/`monitors`/`statusPages`; `incidents` read-owner/write-deny; default deny. **16/16 emulator tests pass.**
- ✅ Rules deployed to the live Firebase project (replaced expired default test-mode rules).
- 🔶 Account deletion removes the auth user + `users` doc but leaves `monitors`/`incidents`/`statusPages` behind (orphaned data).
- ❓ Login does not gate on `emailVerified` — product decision needed (currently unverified users can log in later).

### 2. Monitor create/edit/delete/pause/resume — ✅
- ✅ Wizard, validation, Firestore CRUD, pause/resume persisted.
- ✅ Paused monitors are excluded by the server scheduler and rejected by the API `checkMonitor` action.
- ✅ Creation no longer claims a fake "first ping"; copy states the first server check runs within a minute.

### 3. Real HTTP/HTTPS availability checks — ✅ / 🟡
- ✅ Server-side 8-check engine (`functions/src/checks.js`): connectivity, full load, content validation, link validation, SSL, DNS, performance score, redirects. Direct `fetch` (no CORS proxy).
- ✅ Unit tests: content validation, link extraction, status aggregation, performance score.
- 🟡 Not deployed; no live checks have run yet.

### 4. Server-side scheduled monitoring independent of the dashboard — ✅ / 🟡
- ✅ `scheduledCheck` Cloud Function (every 1 minute) selects due, active, non-paused monitors via `nextCheckAt`.
- ✅ `nextCheckAt` honored from `intervalSeconds` (30s floor); tested.
- 🟡 Requires `firebase deploy` + verification that Scheduler runs.

### 5. Configurable intervals and failure thresholds — ✅
- ✅ `intervalSeconds` drives scheduling; `alertAfterFailures` drives the down transition (default 3).
- ✅ Tested: no incident before threshold; `alertAfterFailures: 1` alerts immediately.

### 6. Incident creation, deduplication, recovery, history — ✅ / 🟡
- ✅ Incident created once per continuous outage; duplicates prevented by open-incident guard.
- ✅ Recovery resolves all open incidents and sends one recovery notification.
- ✅ 15-minute alert suppression prevents rapid duplicate emails.
- ✅ Server-owned incidents (client cannot write them).
- 🟡 Requires deployment to take effect.

### 7. Accurate uptime and response-time history — ✅ / 🟡
- ✅ `uptimeChecksTotal`/`uptimeChecksPassed` counters from genuine check results; `uptimePercentage` computed server-side.
- ✅ `computeUptime` returns `null` with no history; UI shows "No data" instead of 100%.
- ✅ Dashboard chart, monitor 90-day grid, response history, SLA state all derive from persisted `checkHistory`.
- ✅ Persisted history/incident payloads strip raw page bodies (`responseBody`) and cap `brokenUrls`, so documents cannot approach the 1 MiB limit.
- ✅ Every check writes `lastCheckedAt` plus `lastSuccessAt`/`lastFailureAt`.
- 🟡 History starts accumulating only after the first deployed scheduled check.
- 🔶 Report content still derives *checks* from counters only; no historical date-range filtering yet (custom/daily ranges label the period but aggregate lifetime data).

### 8. Usable dashboard states (empty/loading/error/paused/degraded/down/operational) — ✅
- ✅ Real empty states, loading spinners, honest "No data" metrics; status badges include paused/degraded/down.
- ✅ No random/fabricated chart data in the dashboard or monitor details.

### 9. Monitor details, check history, incident details — ✅
- ✅ Real Test Now (server check), real response chart + day grid, real history tab, SLA computed against target, incident list with timeline data from Firestore.

### 10. Basic settings and notification configuration — 🔶
- ✅ Alert contacts + alert-after-N-failures + recovery toggle are stored and used by the server engine.
- ✅ Report email now goes through the server API (no client key).
- 🔶 `notificationPrefs` / quiet hours are stored but never read.
- 🔶 Slack/Discord webhook inputs are stored but never sent (optional feature presented as functional — must be implemented or clearly disabled).
- 🟡 Email sending requires `RESEND_API_KEY` secret + deployed functions.

### 11. Responsive desktop/mobile layouts — ✅
- ✅ Existing responsive layout + hamburger nav preserved; no redesign in Phase 1.

### 12. Deployment and testing process — 🔶
- ✅ `npm run test:unit` (24 tests) and `npm run test:rules` (16 emulator tests).
- ✅ Static deployment config matches architecture (no build step, root output).
- ✅ Vercel deployment restored (see §A).
- ✅ Firestore rules deployed.
- ❌ Cloud Functions are NOT deployed: project `pulsegrid-f5631` is on the Spark plan and Firebase refuses the deploy (`must be on the Blaze plan`). Server checks/scheduler/ingest stay inert until the project upgrades to Blaze.
- ❌ Android CI workflow fails before Gradle (needs authenticated logs); local Gradle build works.
- ❌ No automated syntax/lint check for `app.jsx` (compiled in-browser by Babel; no build step).

---

## C. Remaining known issues (core-adjacent)

| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | Vercel production was stale (pre-Phase-1 app); now restored and pushes deploy | 🟡 P1 | Verify new assets after push |
| 2 | Cloud Functions not deployed: Firebase project is on Spark, requires Blaze | 🔴 P0 | Upgrade plan → `firebase deploy --only functions` → set `RESEND_API_KEY` |
| 3 | Old Resend key may still be valid until rotated | 🔴 P0 | Manual: Resend dashboard rotation |
| 4 | Account deletion orphans monitors/incidents/statusPages | 🟠 P1 | Cascade delete (client or function) |
| 5 | `emailVerified` not enforced at login | 🟠 P1 | Product decision |
| 6 | Slack/Discord/quiet-hours settings are inert UI | 🟠 P2 | Implement or disable with honest copy |
| 7 | API Access / API Docs show fake keys and document a nonexistent REST API | 🟠 P2 | Remove or implement; currently misleading |
| 8 | Public status page missing (publish toggle has no renderer) | ⚪ P2 | Optional feature |
| 9 | Scheduled/periodic report delivery not implemented (manual send only) | ⚪ P3 | Optional |
| 10 | Multi-region labels are logical only (single server runtime) | ⚪ P3 | Optional; requires distributed workers |
| 11 | Billing/plans placeholders; all users `plan:'pro'` | ⚪ P3 | Optional |
| 12 | Team management absent | ⚪ P3 | Optional |
| 13 | PWA (`sw.js`/`manifest.json`) and Capacitor config orphaned | ⚪ P3 | Hygiene |
| 14 | `index-full.html` (204 KB dead page) retained locally, excluded from deploy | ⚪ P3 | Delete in a hygiene pass |
| 15 | `START.md` describes a deleted PostgreSQL backend | 🟠 P2 | Replace with accurate README |
| 16 | Android CI broken; assets now synced locally | ⚪ P3 | Optional delivery channel |

---

## D. Phase plan (core first)

**Immediate (deployment restoration — no code dependency)**
1. In Vercel: identify the project that serves this repo. If `pulse-grid-seven` still has the project, redeploy `main` (production) and attach the desired hostname. If the project was deleted, create a project from `TrumperBee/PulseGrid` (framework: Other; build: none; output: `.`). The repo now has `.vercelignore`, so only web files are published.
2. Verify: `/` serves `index.html`, `/app.jsx` and `/styles.css` return 200 with content, the app loads and login works.

**Immediate (make monitoring real — manual Firebase steps)**
3. Rotate the Resend key; set `RESEND_API_KEY` as a Functions secret.
4. `firebase deploy --only functions,firestore:rules,firestore:indexes`.
5. Verify one monitor: Check Now returns a real result; after 2–3 minutes `scheduledCheck` updates statuses with no browser open; `nextCheckAt` is set; incidents open/resolve correctly.

**Next core hardening (small, reviewable)**
6. Cascade account deletion (monitors/incidents/statusPages).
7. Decide `emailVerified` policy and enforce consistently (client + rules if needed).
8. Make notification settings honest: wire quiet hours, or label Slack/Discord "not yet available" and disable inputs. Remove fake API keys/docs or implement real API keys.
9. Replace `START.md` with an accurate README (local dev, tests, deploy, required secrets).

**Optional (only after core is stable)**
10. Public status pages, scheduled reports, multi-region workers, billing, teams, PWA, Android CI fix.

---

## E. Verification commands

```bash
npm run test:unit    # 24 tests — core state machine, scheduling, uptime, checks, payload trimming
npm run test:rules   # 16 tests — Firestore rules (emulator)
node server.js       # local static server, http://localhost:3000
# Deploy: Vercel (static) and Firebase (functions/rules) — manual, requires approval
```
