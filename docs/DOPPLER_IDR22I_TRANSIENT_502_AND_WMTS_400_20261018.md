# Mackay IDR22I transient Doppler frame 502 and WMTS time 400 — 2026-10-18

## Reported failure
Chrome console: repeated `/radar-frame?product=IDR22I&file=...` HTTP 502, during native Doppler playback and 2-frame prewarm. Separately, a `/wmts` URL ending `time=2026-10-18T04:35:00Z` returned HTTP 400.

## Independently verified source facts
On 18 October 2026 05:39 UTC GitHub Actions queried the **existing production Cloudflare relay** once:
- `/radar-history?product=IDR22I` HTTP 200, **seven authentic BoM timestamped frames** from 05:04 to 05:34 UTC.
- PNG images at 05:04, 05:09, 05:14, 05:19, 05:29 and 05:34 returned genuine image/png and HTTP 200.
- PNG 05:24 did not respond within the individual 10-second test deadline; this is not evidence the scan was absent permanently.
- WMTS exact 04:35 UTC URL returned 400 with body **"failed to validate requested value for dimension (time)"**: source time unavailable/invalid. Never treat it as a valid observed reflectivity tile.
- Direct BoM images from the GitHub runner returned source access denied (403), while the existing relay served six frames successfully. Do **not** replace the relay with browser direct-to-BoM requests.

## Minimal production mitigation
- Only historical Doppler PNG fetches have a 12-second client deadline and a **75-second per-exact-URL negative cooldown** after HTTP 429/502/503/504 or request timeout. An absent source frame is skipped; previously displayed genuine wind remains visible; playback moves to the next authentic scan. On cooldown expiry the original BoM PNG is retried automatically.
- Different Doppler filenames, selected radars, BoM live observations, history discovery and all reflectivity are unaffected. The cooldown map is bounded to 64 frame URLs and prunes expiry entries. No server, new polling, inferred wind, replacement images or new Cesium entities.
- The WMTS HTTP 400 already has an exact URL negative cache in `radar-request-pressure-v1.js` (5 minutes by default); source-unpublished times remain rejected rather than represented as blank/no rain. Expected first HTTP rejection may still appear in DevTools.
- Publish `frontend/src/bom-doppler-intake-v3.js` alone as a strict post-seal overlay in the pinned `scripts/build-current-site.sh`. Bust its existing import from the sealed entry-point, leaving sealed radar/3-D/playback/science baseline unchanged.

## Acceptance
- Full frontend regression, PR validation and pinned V10.2.0 production dry-run, plus deployed public `BUILD.txt` and Doppler module cache-bust check.
- Existing expected results of native Doppler tests, offline stage handover, available frames and velocity data unchanged.
- Do **not** claim a single source 502 will never occur again. BoM/Cloudflare may intermittently fail, but **repeated polling of the same unavailable frame during prewarming/playback must stop for 75 seconds**.
- Read-only diagnostic remains on demand in `scripts/probe-live-idr22-source-v1.mjs`; it is not run by routine CI and does not poll continuously.
