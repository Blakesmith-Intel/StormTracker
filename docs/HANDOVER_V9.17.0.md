# StormTracker V9.17.0 — engineering and operations handover

**Status:** Accepted production release candidate after preview/mobile sign-off. Tag on verified deployment: `v9.17.0`; immutable recovery: `restore/v9.17.0`. Previous sealed fallback: `v9.16.15`. Site: https://blakesmith-intel.github.io/StormTracker/.

## Architecture and protected invariants

- Browser-only static Cesium UI on GitHub Pages. Cloudflare Worker remains transport/CORS only; no remote meteorology runtime.
- Native BoM national WMTS reflectivity imagery in **dBZ only**; 15 original source RGB categories. All 3-D inference operates on dBZ and original AURA 5-event profiles. No rain-rate conversion.
- Source-measured ≥40 dBZ segmentation with ≥16 observed connected pixels; 2-pixel connection gap and strong-core protection. No minimum km² filter.
- Separate measured 2-D data, inferred 3-D cloud sprites and genuine Doppler radial velocity. Gnomonic Doppler calibration supported for 08/50/66; other wind panels are contextual until separately validated.
- Five-minute visible-tab checks, independent source timestamps, bounded real-source history, eligible interpolation for **display only** and no fabricated measured storm tracks.
- One primary plus three extra measured-radar map windows; primary controls tracks/3-D/wind. Reference map context and official provider records remain isolated.

## Major files

- `frontend/src/border-radar-sites-v1.js` — 22-site catalogue and exact NSW product whitelist; `dopplerIntegrated:false` gates Brewarrina.
- `frontend/src/qld-radar-sites-v1.js` — original, unchanged 19 Queensland-site / Doppler catalogue.
- `frontend/src/context-layers/radar-site-name-overlay-v1.js` — SVG-based clickable location markers; accessible label, geographic position, declutter, hidden/occluded projection and cleanup.
- `frontend/src/operational-dashboard-v9-1.css` — borderless, low-clutter 18px vector glyph and 32–34px transparent hit target.
- `frontend/src/live3d-operational-v9.js` — primary selection and source-affine rendering, track and volume visual layers.
- `frontend/src/volumetric-visual-v2.js` — BoM colour matching, blob sprite, neutral 1.0× and intensity-dependent display multiplier.
- `frontend/src/measured-track-volume-v1.js` — `source_low_level_dbzh` *per measured pixel*, fixes track-wide maximum incorrectly stretching weaker columns.
- `frontend/src/inferred-volume-v1.js` and `frontend/3d-models/inferred_vertical_profile_model_v2.json` — empirical inference, unchanged.
- `frontend/src/bom-wmts-loop-v2.js` — geographic radar coverage windows; `frontend/src/multi-radar-display-v9.js` — supplemental windows.
- `frontend/src/bom-doppler-intake-v3.js`, `frontend/src/bom-doppler-georef-v1.js`, `relay/worker.js` — source transport and guarded Doppler path.
- `frontend/tests/run-volumetric-visual-v2-tests.mjs`, `run-nsw-border-radar-site-labels-v1-tests.mjs`, `run-nsw-brewarrina-doppler-contract-v1-tests.mjs` plus all legacy regression suites.

## Outstanding and known boundaries

1. **Brewarrina `IDR93I` not operational in release:** whitelisted by exact ID only, but disabled in client until isolated `stormtracker-bom-relay-nsw-preview` Worker is deployed under a suitable Cloudflare token, historical PNG/colour/timestamps validated, and map calibration tested. Existing QLD relay MUST NOT be changed merely to enable this.
2. Other NSW sites Moree and Grafton: reflectivity coverage windows only. No assumption of Doppler wind availability.
3. Relative *drawn* volume height responds to low-level dBZ, but cannot be interpreted as real measured echo top, convective severity threshold or objective height estimate. Future measured-volume upgrades require new validated multi-elevation inputs.
4. Scene performance on mobile should be monitored under widespread ≥40 dBZ events and four concurrent coverage windows; avoid sprite proliferation and frame stutter.
5. v10 research alerts (hook echo, destructive gusts) remain experimental and must never be silently promoted to warnings.
6. Lightning observations remain source blocked unless a legitimate reliable public feed exists.
7. Test all source-layer expiry and click interactions after future map-label and weather rendering refactors.

## Release and rollback

Run `npm test` / `node --check relay/worker.js` on exact candidate, deploy only a **pinned GitHub release SHA**, verify public `/BUILD.txt`, frontend assets, dBZ legend, blob render, radar marker behaviour, source gates and no regression of old native Doppler. Let Pages workflow create/verify immutable `v9.17.0` and `restore/v9.17.0`. If rollback needed, repoint **the Pages production checkout and BUILD marker** to original `v9.16.15` exact commit `ec3508dc7c2e263b1f3fcfc16803bc5bc7e469f5`, run workflow, verify public root, and preserve both immutable tags. Never force-move tags.
