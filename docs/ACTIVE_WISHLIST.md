# StormTracker — active roadmap after sealed V9.19.0 (15 October 2026)

The new production and development recovery baseline is `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` (tag `v9.19.0`; recovery branch `restore/v9.19.0`). V9.18.0 (`66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`) and the older accepted V9.18 diagnostic remain immutable for rollback. Any new work must start from the sealed V9.19.0 source, not from a historical experimental preview.

## Priority order

**P0 — Source integrity / operational safety.** Real BoM observations and source clocks only. Failure isolation for live radar, gauge history, outages and closures. Never show old-UTC secondary radar imagery next to a newer primary observation or synthetic interpolation as measured data.

**P1 — Stability.** Regression-first resolution of browser freezes, WebGL texture lifetime, map navigation/satellite persistence, smooth frame handover, labels and paused visibility. The user accepted V9.19.0, including source-faithful inferred-frame playback and low-motion-confidence cone withholding; reopen regressions only with concrete browser evidence.

**P2 — V10 severe-weather candidates.** Use BoM-defined damaging/destructive-wind thresholds and source-faithful Doppler analysis, with yellow damaging straight-line winds, orange possible hook-echo, and red tornado/circulation icon. This is an experimental situational-awareness feature, not an official warning. Start with Gympie/Cooloola 24 November 2025 and Christmas 2023 Gold Coast storm/derecho cases; the saved local research fixtures and full tests must be validated before browser preview.

## Preserved design constraints

- Static GitHub Pages app with existing Cloudflare transport-only relay; no paid or server-side weather inference.
- BoM reflectivity remains dBZ, including 2-D legend and inferred 3-D.
- Primary radar owns tracks and Doppler. Up to three other windows display source-synchronised reflectivity with bounded empirical inferred 3-D; overlapping measured pixels must not duplicate volumes.
- Inferred volume minimum **40 dBZ**, height scale defaults **1.0×**, strength-dependent presentation height, independent opacity.
- No arbitrary 6 km² cell-area threshold; segment from connected observed 40 dBZ pixels.
- Storm ID Labels OFF by default, note that only PRIMARY radar creates storm IDs; track points/labels linked and toggleable on paused frames. Separate +90m cone control persists, withholds uncertain motion and stays source-anchored.
- QLD flood-road closures, unplanned current electricity outages, exceptional BoM river signals and QFD incident context remain operationally distinct.
- Severe-weather detector is for situational awareness; review source support and false-positive risks before any alert deployment.

## Release gate

No FUTURE production promotion before full frontend/relay CI, GitHub Pages artifact verification, observable mobile/desktop playback and explicit acceptance. V9.19.0 was expressly accepted on 15 October 2026; the release itself must still pass exact-SHA public verification. Do not re-enable obsolete release-preview workflows or historical installation packages.
