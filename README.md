# StormTracker — V9.19.0 production release source

StormTracker is a **browser-only Queensland and southern-border BoM radar situational-awareness viewer**, not an official warning service or emergency management decision-making tool. Original radar reflectivity is in **dBZ**; Doppler measures radial velocity rather than storm motion; 3-D volumes and storm cones are inferred visualisations, not authoritative forecasts.

## Release and supported browser sites

| Build | URL | Source policy |
| --- | --- | --- |
| **StormTracker V9.19.0 production** | https://blakesmith-intel.github.io/StormTracker/ | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` (pinned; `v9.19.0` tag, `restore/v9.19.0`) |
| Historical accepted diagnostic (V9.18) | https://blakesmith-intel.github.io/StormTracker/preview/radar-history-fix/ | Immutable `acfa0ebd3717a793369e3e887e2d1a54785620b7` |

The last sealed production release, **V9.18.0**, remains at commit `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` with immutable tag/restore branch, available for rollback. The previous `next-baseline` preview was explicitly approved by the operator on 15 October 2026. The V9.19.0 production pin includes the same source features plus required root-path stability guards. Its superseded candidate preview is retired; only the historical accepted V9.18 QA path is retained.

## V9.19.0 behaviour

- Primary + up to **three** additional original BoM radar reflectivity sites; atomic source-timestamp handover and bounded hold during display-only inferred frames. Primary playback never blocks waiting for optional supplemental WMTS.
- Stable browser Cesium navigation, deferred resource cleanup, suppressed high-cost GPU hover picking, bounded upstream radar requests, graceful failure isolation, responsive hide/show sidebar.
- Original BoM dBZ and >=40 dBZ inferred rounded 3-D storm volumes with independent opacity and terrain; regional satellite QLD continuity and DEA regional NSW imagery with NSW detail at close scale.
- **Storm ID Labels off by default**; storm tracking, labels and +90-minute cones are generated only from the **primary** radar. Secondary radars contribute imagery/inferred volume but **not** storm IDs or cones.
- +90-minute predicted motion uses only real measured centroid history; 0m origin, 30/60/90m markers and a confidence gate. Unsupported/abrupt low-speed motion **withholds** extrapolation, rather than showing misleading predictions.
- QLD unplanned road closures and power outages, BoM flood signals (green rapid above minor, yellow moderate, red major, cyan unusual tidal screening), selected QFD incidents. BoM bulletins are authoritative.

## Files and maintenance

- `frontend/` — static browser app and regression tests.
- `relay/` — existing Cloudflare transport-only CORS Worker, unchanged for this release.
- `scripts/` — Pages builder and scientific/operational source audits.
- `docs/RELEASE_NOTES_V9.19.0.md`, `HANDOVER_V9.19.0.md`, `USER_GUIDE_V9.19.0.md` — current release details.
- `docs/BASELINE_RESTORE.md`, `CURRENT_ACCEPTED_BASELINE.md` — immutable release recovery instructions and exact SHA pins.
- `.github/workflows/pages.yml` — publishes the site root from an **exact** sealed production SHA; `main` is not implicitly production.

Validation: `npm test`, `node --check relay/worker.js`, deterministic Pages artifact tests and `/BUILD.txt` public verification. Do not replace genuine BoM observations with extrapolated weather frames. Experimental V10 wind/circulation candidate detection remains separate pending authentic BoM AURA volume validation.

## Release discipline

Use a feature branch and preview; test changes, obtain visual functional acceptance, then update **pinned production source** through reviewed changes. Preserve tags/rollback branches. If rollback is required, restore V9.18.0's immutable source SHA and redeploy rather than moving the old tag.
