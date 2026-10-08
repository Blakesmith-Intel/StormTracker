# StormTracker authorised-origin preview acceptance

The static Pages workflow publishes accepted production files from `main/frontend`
at `/StormTracker/` and copies the independently tested development
frontends into **isolated** sibling directories:

- [V9.14 preview](https://blakesmith-intel.github.io/StormTracker/preview/v9.14.0/)
- [V9.15 preview](https://blakesmith-intel.github.io/StormTracker/preview/v9.15.0/)

They share the Cloudflare relay's allowed browser origin
(`https://blakesmith-intel.github.io`); GitHack and localhost do not.

## Preview publication refresh — 8 October 2026

The V9.15 candidate has corrected the QFD symbol legend startup so the
three authentic published ArcGIS `GroupedType` icons are fetched when
the page first loads, **even with the QFD incidents checkbox off**.
Transient renderer failures can be retried on tab resume or the
existing ten-minute timer without enabling incident polling.

The development branch passed the full frontend regression suite,
including the disabled-layer icon-loading and transient-retry test.
Changing this documentation file triggers the existing main-branch
Pages workflow to package the latest candidate assets into the
**preview directories only**. It does not merge V9.14 or V9.15 into
production and does not change any `main/frontend` runtime files.

## Acceptance still required

- Confirm all three icons in V9.15's disabled-layer legend are the
  actual QFD ArcGIS image samples rather than provisional fallbacks.
- Confirm enabling QFD still shows only Technical Rescue, Road Crash
  Rescue and Assist Public, and incident details remain clickable.
- Confirm BoM reflectivity and Doppler still load, including the
  always-on tracked 3-D measured-core projection.
- Continue contextual source QA (QLDTraffic closures, power outages and
  BoM flood signals); unavailable river station histories must remain
  clearly disclosed and must never be presented as a verified no-flood
  state.

Production remains V9.13.4 until each newer version is explicitly
accepted and sealed. Avoid altering the relay origin allowlist.

## V9.15 preview refresh — volumetric opacity (8 October 2026)

The current V9.15 development candidate adds an independent third
**3-D volume opacity** slider to the existing radar/Doppler opacity controls,
defaulting to **100%**. The control applies only to the inferred volume
dots and measured-echo projection within tracked volumes. Radar surface
imagery and Doppler overlay remain independent. The original measured
dBZ/BoM categories, inferred vertical intensity, tracking and
confidence model are not recalculated or changed.

Tests verify 0% → 100% restores the original measured-core colour
and original inferred confidence-based opacity without cumulative fade.
The previously accepted QFD official-icon-on-load change is retained.
The V9.15 candidate's startup module cache version is updated for
this preview refresh.

As before, refreshing the generated Pages preview folder does **not**
merge the pending V9.14 or V9.15 feature PRs into production. Main
`frontend/` remains the previously accepted V9.13.4 root build.

## V9.15 authorised preview refresh — strict QLDTraffic + source icons

This update **does not change production frontend code** and does not merge
the V9.14 or V9.15 candidate PRs. The existing GitHub Pages workflow
independently tests and copies the latest candidate files into
`/StormTracker/preview/v9.15.0/` under the allowed Cloudflare CORS origin.

V9.15 now uses the isolated Worker `/flood-road-closures-v9-15` route.
The original `/flood-road-closures` endpoint and its v4 cache are
preserved for production. The V9.15 route uses its own v5 cache and
requires official QLDTraffic to say **Road closed to all traffic** due
to Flash flooding, Long-term flooding, Earlier flooding or Heavy rain.

[Live deployed relay validation](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37796359282)
passed against the official upstream GeoJSON, including Laidley Creek
West Road (event 750590), and verified browser-origin CORS. The
original public QLDTraffic road-closed PNG is shared by Cesium map
pins and the legend. Storm-track labels now change immediately on
paused frames without waiting for a new radar update.

After this Pages deployment completes, verify the icon/closure
presentation and paused label switch in the actual V9.15 browser preview.
No full release/seal until operational visual acceptance.

## V9.15 updated closure scope — all unplanned reasons

The V9.15 candidate has expanded from weather-only closures to **any
officially published, currently active closure to ALL traffic for an
unplanned cause**. Explicit planned roadworks/scheduled events and
through-traffic-only closures remain excluded. Emergency works and
other unplanned hazards qualify regardless of weather cause.

The original production `/flood-road-closures` route retains its legacy
v4 policy/cache. V9.15 uses its isolated
`/flood-road-closures-v9-15` route with a new v6 cache and
authorised Pages CORS. The QLDTraffic map and legend continue to use
the matching official road-closed-to-all-traffic PNG.

**Live release evidence:** GitHub Actions
[deployment and QLDTraffic reconciliation](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37799107199)
passed. During that snapshot, QLDTraffic's official GeoJSON contained
**nine eligible unplanned all-traffic closures** (seven Hazard and
two Flooding), and V9.15's live relay returned the same nine IDs
including Laidley Creek West Road 750590. The original production
route continued to return its four legacy records.

This documentation-only PR refreshes the browser preview from the
candidate branch and does **not** merge V9.14 or V9.15 into production.
Verify the current live map presentation before release acceptance.
