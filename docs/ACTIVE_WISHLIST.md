# StormTracker — active roadmap after accepted V9.18 diagnostic (13 October 2026)

The next baseline for development is `acfa0ebd3717a793369e3e887e2d1a54785620b7` (recovery branch `restore/v9.18-accepted-diagnostic-20261013`). The sealed production V9.18.0 remains separate.

## Priority order

**P0 — Source integrity / operational safety.** Real BoM observations and source clocks only. Failure isolation for live radar, gauge history, outages and closures. Never show old-UTC secondary radar imagery next to a newer primary observation or synthetic interpolation as measured data.

**P1 — Stability.** Regression-first resolution of browser freezes, WebGL texture lifetime, map navigation/satellite persistence, smooth frame handover, labels and paused visibility. The user's accepted V9.18 QA has cleared the major issues; reopen only on evidence of a regression.

**P2 — V10 severe-weather candidates.** Use BoM-defined damaging/destructive-wind thresholds and source-faithful Doppler analysis, with yellow damaging straight-line winds, orange possible hook-echo, and red tornado/circulation icon. This is an experimental situational-awareness feature, not an official warning. Start with Gympie/Cooloola 24 November 2025 and Christmas 2023 Gold Coast storm/derecho cases; the saved local research fixtures and full tests must be validated before browser preview.

## Preserved design constraints

- Static GitHub Pages app with existing Cloudflare transport-only relay; no paid or server-side weather inference.
- BoM reflectivity remains dBZ, including 2-D legend and inferred 3-D.
- Primary radar owns tracks and Doppler. Up to three other windows display source-synchronised reflectivity with bounded empirical inferred 3-D; overlapping measured pixels must not duplicate volumes.
- Inferred volume minimum **40 dBZ**, height scale defaults **1.0×**, strength-dependent presentation height, independent opacity.
- No arbitrary 6 km² cell-area threshold; segment from connected observed 40 dBZ pixels.
- Labels/track trails toggle on paused frames; separate threat-cone control persists.
- QLD flood-road closures, unplanned current electricity outages, exceptional BoM river signals and QFD incident context remain operationally distinct.
- Severe-weather detector is for situational awareness; review source support and false-positive risks before any alert deployment.

## Release gate

No production promotion before full frontend/relay CI, GitHub Pages artifact verification, observable mobile/desktop playback and explicit acceptance. Do not re-enable obsolete release-preview workflows or historical installation packages.
