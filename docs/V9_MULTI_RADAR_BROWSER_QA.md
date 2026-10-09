# V9.16.15 Multi-Radar — Real-Browser Acceptance Evidence

## Production isolation

- Feature branch: `feature/v9-multi-radar-display` / draft PR #63.
- Production source remains sealed at V9.16.14 commit `0c7424abdc659e5874595473c0e91953ffa0a48b`. No merge/tag/Pages deployment made as part of these checks.
- This is **original BoM WMTS data** replayed within real headless browser engines, **not** seeded radar imagery or test-generated storms.

## Actual 10 October 2026 AEST browser runs

| Target | Result | Evidence |
| --- | --- | --- |
| Mobile WebKit, 390×844 touch-sized viewport | **PASS**, full end-to-end scenario | https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37995964494 |
| Desktop Chromium, 1440×900 headless software WebGL | **BLOCKED / FAIL**, after real primary radar history loaded, at Pause control interaction | https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37995964494 |
| Full existing frontend + multi-radar contract tests | **PASS** (99 frontend regression suites) | Same browser workflow validation job and PR check statuses |
| Real live BoM WMTS source diagnostic | **PASS** for original 5-minute frames in a bounded recent source window | https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37994938278 |

### Mobile WebKit verified behaviour
1. True map loaded primary **66 Mt Stapylton**, secondary **50 Marburg** and **08 Gympie** at the same recorded source UTC.
2. Overlapping BoM national-mosaic tiles were correctly recognized and not double-painted; e.g. one site may be reported **already covered**.
3. Added **24 Bowen**, with an authentic distant source image; **Fit selected** moved camera to ~150.65784°E, -23.80175° latitude with a ~1040 km range.
4. Original measured-frame controls and paused history scrubbing, clearing supplemental layers back to primary only, and preservation of the original hidden primary-controlled Doppler source ID passed.
5. Site checklist was usable **during initial primary source loading** and remained within the mobile viewport (example: x=65, y=387, width=320, height=323 for a 390×844 simulated mobile Safari/WebKit screen).

### Desktop Chromium observation (not a pass)
The full 1440×900 Cesium/WebGL software-rendered runner loaded genuine primary reflectivity history and verified radar-selection UI geometry and three-site selection. After that, the headless software-WebGL browser did **not** transition the Play/Pause control quickly enough (even with an explicitly dispatched click). This timing/deadline failure is a blocker for automated desktop acceptance; it is not a measured proof of browser performance on actual GPU-accelerated desktop hardware. The corresponding desktop job remains **failed**.

**Do not merge or seal** until desktop live UI / frame advance can be verified on a real hardware-accelerated Chromium environment (or a suitably performant equivalent test runner), with primary 66 + 50 + 08 and 66 + distant 24, camera pan/zoom, measured history scrub, native Doppler-only transition, and preserved 3-D/source labels.

### Source availability and limits
- BoM WMTS presently returns real PNG imagery for a recent rolling 5-minute timestamp window and HTTP 400 "failed to validate requested value for dimension (time)" for outside-window/nonpublished requests. This is a genuine upstream response, not invented image data.
- Local preview network CORS differs from the deployed Pages origin. The browser test fetches untouched upstream image bytes and changes **only** the response's Access-Control-Allow-Origin header for localhost.
- Headless SwiftShader/Playwright screenshot capture was unstable; screenshots are **not** asserted as a validated map-image visual record. The mobile pass covers real browser DOM, Cesium state, original imagery source, selections, map coordinates, rendered supplemental layer presence and controls. Final human visual approval remains pending.
- This release intentionally adds extra **2-D reflectivity windows only**, not independent Doppler fusion or multi-site storm-science inference.
