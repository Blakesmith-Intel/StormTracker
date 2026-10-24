# StormTracker v10.2.9 — Flood-gauge recovery

**Date:** 24 October 2026 (AEST)  
**Production site:** https://blakesmith-intel.github.io/StormTracker/  
**Release tag:** `v10.2.9`  
**Immutable recovery branch:** `restore/v10.2.9`  
**Underlying scientific radar/cyclone baseline:** V10.2.0 unchanged.

## Scope

- Remove confirmed flood-stage gauge markers when a **new, fresh, measured height** falls below that **exact gauge's verified published minor threshold**, regardless of an older class echoed in a bulletin. Don't infer recovery from stale/missing readings.
- Gauges **without BoM-published flood stages**: when a station genuinely triggers a rapid-rise alert, preserve its directly observed *pre-rise* water height, keyed only by exact source station ID. It is a measured pre-rise reference, **not** an official normal-water or minor-flood benchmark.
- While fresh readings remain above the same gauge's pre-rise reference, continue showing its icon as **blue elevated** without the rapid-rise arrow once rising ceases. Two distinct fresh, non-rising readings at least 15 minutes apart close to the original pre-rise reference are required to retire the marker. No arbitrary state-wide "normal" value, threshold substitution or nearby-station interpolation.
- Source outages or unchanged timestamps are **not** proof of recovery. Continue visibly marking recent retained observations as stale, and expire old unverified rate-only event records after a bounded 48-hour absence of new source evidence; never mark an outage as safe.
- Respect tidal screening, BoM-stated minor/moderate/major severity, rate-only flash screening disclaimers and gauge position/source integrity. The map uses the same source station coordinates, original 10-minute refresh and existing map layers.

## Verification and freeze

Tests include source-time handling, two distinct recovery observations, event persistence through a browser reload, stale data, tidal exclusion, historical thresholded Mirani station recovery and original severity rendering; full regression and production-equivalent Pages dry-run must pass before release. GitHub Pages verification must establish that the currently served versions include these changes **before** the immutable annotated tag `v10.2.9` and recovery branch are created.

Previously frozen release tags and restore branches are not moved. Any further modification requires a new release.
