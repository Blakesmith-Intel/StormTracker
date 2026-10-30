# StormTracker V10.2.37 — radar automatic refresh and genuine missed-frame recovery

**Date:** 31 October 2026. **Change scope:** narrowly targeted, additive correction to the existing production radar polling and history loader. The original accepted V10.2.0 scientific engine and all earlier frozen tags/restore references remain untouched.

## Operator-approved change

- Retain the existing 300,000 ms (five-minute) automatic polling cadence while the app is active; rearm the next poll independently of a slow request.
- If another operation is occupying the radar loader, retain a pending check and retry after 2,000 ms, never with concurrent loads. The one pending-check rule also applies if a poll arrives while the automatic request itself is in flight.
- Preserve the immediate existing `visibilitychange` foreground check and existing five-minute background throttling/visibility behaviour.
- Retrieve the newest **up to nine genuine BoM WMTS published timestamps** for automatic recovery, rather than discarding everything except the latest timestamp. Apply unchanged source-pixel verification and existing source-only/observed-frame eligibility; cache and worker rebuild preserve source UTC and chronological order.
- Keep last automatic-check UTC, latest successfully accepted radar UTC and the latest failure reason in a read-only diagnostic snapshot `window.__stormtrackerRadarAutoRefreshAudit()` and in the existing auto-refresh status tooltip. No new map layers or UI controls are introduced.

## Safety boundaries

No changes to Doppler ingestion or matching, public BoM warning products, station/gauge/rainfall/AEP/IFD sources, storm tracking, 3-D inference, colour tables, radar georeferencing, selected windows, published frame freshness rules, or rendering. No invented timestamps, reconstructed observations or missing-tile substitution. The five-minute polling cadence is unchanged; the short retry is invoked only for a busy/deferred check.

## Release checks

- Unit tests: `run-live-loop-refresh-v1-tests.mjs` (timer, pending retry, no overlap, foreground-triggered checks, error recovery).
- Production contract: `run-radar-auto-refresh-v10-2-37-tests.mjs` (real published times, missing scan catch-up, Gladstone and other sites, archive, deployed build source and versioning).
- Complete frontend regression via `npm test`, followed by `scripts/build-current-site.sh`, `scripts/apply-ftp-aep-release-v10.py`, and `scripts/apply-radar-auto-refresh-v1.py`; validate the **built** operator runtime.
- GitHub Pages must successfully publish and verify the V10.2.37 marker plus the production engine and scheduler before acceptance is claimed.

## Rollback and provenance

This is a **new production overlay** on the existing pinned source; older frozen tags/restore branches are not moved. The new source commit and successful Pages run form the release provenance. Do not claim deployment or immutable sealing unless the Pages job and its post-publication checks succeed.
