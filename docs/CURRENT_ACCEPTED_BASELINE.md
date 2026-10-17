# StormTracker — Current Accepted Production Baseline: V10.0.0 (17 October 2026)

**Source-pinned V10 release:** `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5` · immutable annotated tag `v10.0.0` · restore branch `restore/v10.0.0`. Tags and restore branches must be created only after successful public deployment and source verification.

**Production:** https://blakesmith-intel.github.io/StormTracker/
**Public BUILD.txt:** `SEALED StormTracker V10.0.0 source e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`

## Preserved functionality
- One permanently simplified, viewport-bounded operator sidebar; no More options, duplicate white radar time or obsolete terrain/research/volume checkboxes. Terrain stays on except dedicated performance-test paths.
- Original measured BoM dBZ reflectivity, full-quality empirical >=40 dBZ 3-D, up to three extra radar sites, primary-only track labels and illustrative 90-minute storm motion cone.
- Original source-pixel Doppler on primary and, in Doppler-only mode, independent authentic velocity imagery for each selected supported secondary site. Secondary timestamps must be within eight minutes of the primary frame; never fabricate source frames or label an old observation as current. Missing/unverified BoM products (including NSW sites pending validation) are omitted.
- Queensland/NSW satellite continuity, towns, official flood/traffic/power/QFD layers, LGA explorers and impacted customer counts, genuine refresh timestamps, manual map measurement and scale, responsive diagnostic dialog.
- Existing source quality and inference distinctions in `docs/NON_NEGOTIABLE_VISUAL_FIDELITY.md` and `docs/SCIENTIFIC_CONTRACT.md`.

## Immutable recovery
The previously accepted `v9.20.2` and `restore/v9.20.2` remain at `b8be458acbae942a3bb0b530a5c17618b6d03134`, with older tags and source pins unchanged. Never repoint them.

## Development remains separate
Official live BoM tropical cyclone forecast tracks and official forecast uncertainty polygons are **not yet live**. Upcoming implementation must use actual valid-time official BoM data; an arbitrary storm-track cone is not a numeric cyclone probability forecast. Continue with cyclone geometry before later warning polygons/AURA research.
