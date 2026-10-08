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
