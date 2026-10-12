# StormTracker V9.17.0 — release notes and change log

**Release:** V9.17.0 (13 October 2026 AEST; acceptance across mobile and desktop preview). **Scope:** accepted PR #71 visual baseline plus NSW southern-Queensland border radar discovery. **Source of truth:** the `v9.17.0` immutable Git tag and the deployed `/BUILD.txt`.

## Delivered

| Subsystem | What changes | Integrity limit |
| --- | --- | --- |
| Radar catalogue | 22 selectable stations: original 19 Queensland + Brewarrina 93, Moree 53, Grafton 28 | Windows of BoM national WMTS reflectivity, not independent site-scanned fused 3-D |
| Primary selection | Minimalist **18px cyan stroke SVG dish**, borderless/nameless, 32–34px accessible tap targets; hover tooltip and accessible name; click/tap invokes original primary dropdown change | Geographic label projection/occlusion/overlap tested; no change to normal town labels |
| Multi-radar | One primary plus max three supplemental measured-dBZ windows | Add-ons cannot change primary tracking / wind or invent timestamps |
| 2-D reflectivity | The original **15 BoM dBZ categories** and native imagery remain unchanged; unified dBZ legend | No mm/h estimator, no native rain-rate feed |
| Inferred 3-D | Soft rounded sprite blobs instead of isolated dots; original BoM category colours, 40 dBZ display floor | Still empirical AURA-inferred 3-D, not measured |
| Relative volume height | Apply 1.0–1.4× display-only intensity mapping from **each observed source pixel**; no longer reuse a track's peak dBZ on every column | Strong returns may appear taller visually; NOT a measured echo top |
| Vertical exaggeration | Default **1.0×** independent user setting; retained manual control | No modification of true sampled model levels |
| Doppler | Existing QLD display / pairing preserved | Brewarrina `IDR93I` source-whitelisted but disabled until isolated worker and source geolocation are genuinely validated |
| Tracking | Existing 40 dBZ / 16 actual connected-pixel and strong-core rules preserved | No fabricated or area-based new tracks |
| Context | Existing QLD road, outages, flood and rescue indicators retained | Source provenance, expiry and availability remain in force |

## Accepted visual criteria

User approved the rounded blob presentation, correct 40+ dBZ BoM palette, weaker-column relative display height from Richmond mobile screenshot, 1.0× default and final minimalist dish-icon treatment. Preview passed two independent GitHub regression workflows and Pages' public smoke checks before promotion. The production workflow must independently re-run all checks against the sealed source.

## Explicitly NOT in this release

Brewarrina Doppler operational availability; wind-source calibration for NSW; automated tornado or severe-thunderstorm warnings; observed cloud-top height; multi-site radar/Doppler tracking fusion; lightning strike observations; fabrication of missing radar frames.

## Verification / recovery

- `npm test` and `node --check relay/worker.js` on the exact release source.
- Public `/BUILD.txt`, `/index.html`, `/live3d-operational-v9.html`, new model modules, NSW registry and marker SVG code must match the pinned source; existing original BoM and Doppler contracts are regression-checked.
- Tag `v9.17.0` and preserve `restore/v9.17.0`; maintain historical `v9.16.15`.
- See [production restore instructions](PRODUCTION_BASELINE_V9.17.0.md) and [handover](HANDOVER_V9.17.0.md).
