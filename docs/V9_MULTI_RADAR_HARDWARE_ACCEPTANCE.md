# V9.16.15 — Isolated browser preview and desktop GPU acceptance

**Scope:** Draft PR #63, branch `feature/v9-multi-radar-display` only. Do not merge, tag, overwrite the existing Pages application, change the live BoM relay or claim production readiness on the basis of this plan.

## Preview package (no automatic deployment)

Use the Actions artifact from `package-v9-multi-radar-preview.yml`. It is a ZIP whose root is the exact `frontend/` web tree; `live3d-operational-v9.html` remains the direct app entrypoint. The workflow deliberately **does not deploy** to any provider. The ZIP is an inspectable release-candidate input, *not* a live URL.

To enable a remote preview, explicitly create a **separate** Cloudflare Pages static project through the Cloudflare dashboard and upload the ZIP (or use another isolated static host). It must not be the existing production Pages project. Do not connect preview auto-deployment to `main`. No backend build and no separate Worker are required. The expected entrypoint, once the host returns a verified URL, is:
`https://<actual-preview-origin>/live3d-operational-v9.html?qaMultiRadar=1`.
Never infer a domain name or present this placeholder as a real deployed URL.

### Mandatory source-origin gate

The existing BoM relay may reject a newly created Pages origin due to CORS. Open Developer Tools > Network and verify that actual WMTS image requests from the preview are accepted (HTTP 200 PNG for currently published observation times, accessible to the browser). An outside-window HTTP 400 response for WMTS `TIME` is not the same as CORS failure. If CORS blocks the new preview origin, stop and record the blocker. Do **not** change the production Worker automatically or fake frames. A separate same-origin browser route or explicitly reviewed relay configuration would require separate approval.

## Hardware-accelerated desktop acceptance

Open the isolated preview in **desktop Chrome or Edge** with hardware acceleration enabled. First open `chrome://gpu` or `edge://gpu` and verify the **WebGL** rendering path is hardware accelerated (rather than SwiftShader/software). Record browser version, device type, OS and graphics status. `chrome://gpu` is a diagnostic page, not a benchmark; use normal playback to judge responsiveness.

The app contains a read-only diagnostic hook in preview mode:
`window.__stormtrackerMultiRadarDiagnostics?.()`.
Use it in DevTools Console after each milestone to record `primary`, `secondary`, `visibleSupplemental`, `primaryUtc`, `frameCount`, `sourceStatus`, `addedStatus` and `cameraTarget`. Do not require supplemental layers to remain visible during intermediate frames while authentic imagery is loading.

| Test | Action | Acceptance |
|---|---|---|
| Startup | Open app with default radar 66 | Cesium loads, source clock progresses, no persistent background overlays or cut-off place names |
| Multi-region | Select 50 and 08 in addition to 66 | Up to four total sites allowed; genuine measured source windows; duplicates masked rather than painted twice |
| Source UTC | Pause a measured frame | Supplemental windows use exactly the primary scan's original UTC, not latest nearby / interpolated UTC |
| Distant coverage | Clear extras, select 24 Bowen, choose Fit selected | Real distant coverage appears and viewport includes both radar centres |
| Selected-frame change | Pause and move the timeline one observed frame | Primary UTC changes; previous supplementary imagery clears immediately; new data carries that new UTC or remains temporarily absent |
| Site cleanup | Add/remove sites while loading; choose Primary only | No old supplemental imagery is retained; previous async results cannot reappear later |
| Native Doppler | Choose the native Doppler-only mode | Supplemental 2-D rain windows disappear; native Doppler remains at 100% opacity and its original source clock is unchanged |
| Restore rain | Switch to 60-, 120-, and 180-minute rain-only loops | Normal playback and primary science unaffected; supplementary imagery only on genuine measured scans |
| Visual/response | Pan, zoom, pitch, pause/play and move timeline | Map remains responsive, no flickering/duplicate labels, no persistent old frame and no browser crash |
| Mobile cross-check | Open same preview on physical iPhone Safari | Controls fit viewport; multi-site selection, measured frame scrub and cleanup still work |

### Evidence checklist

Capture one screenshot each for 66+50+08, 66+24 after Fit selected, a changed observed frame, and native Doppler-only with supplemental rain absent. Record displayed UTCs, approximate time to load, and whether playback interactions stall. Save the read-only diagnostics for both the source frame and next selected frame. Record specific reproducible errors and network status; do not label an HTTP 400 for unpublished source times as synthetic-data behaviour.

**Accept V9.16.15 only after:** real hardware desktop result PASS, actual iPhone Safari visual result PASS, unmodified 99-suite frontend test PASS, CI diagnostics reviewed, and explicit human visual sign-off. Otherwise PR stays draft and V9.16.14 at `0c7424abdc659e5874595473c0e91953ffa0a48b` remains production.

## Parallel CI diagnostics

`browser-v9-multi-radar-diagnostics.yml` reruns the original live-source Playwright smoke test against a temporary localhost server inside Actions (not production), uploads full per-engine browser reports plus `*-host-timing.json`, and records runner process load, available memory and last passed event. **A hosted headless Chromium pass is not evidence of hardware GPU acceleration.** Persistent high CPU/render starvation on Chromium with WebKit passing is evidence to target the CI graphics environment; it is not by itself proof of an application defect.
