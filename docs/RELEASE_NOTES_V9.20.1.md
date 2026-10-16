# StormTracker V9.20.1 — Secondary Radar 3-D Coverage Hotfix
**Date:** 16 October 2026  
**Parent production baseline:** V9.20.0, operator accepted for reduced memory and eliminated primary 3-D cloud flickering.

## User-reported regression
After V9.20.0 went live, users could see authentic BoM supplementary 2-D radar imagery but could no longer see its corresponding ≥40 dBZ inferred 3-D geometry. The user supplied a short screen recording showing 2-D storms with missing secondary-site 3-D.

## Repair
The V9.20.0 secondary 3-D code sampled only raw source pixel indices divisible by a source-dependent stride and froze that stride from the earliest scan. A legitimate sparse echo can fall between these stride positions, producing no 3-D glyphs. A storm expanding after a quiet first scan could also spend its glyph budget on the first observed source rows.

V9.20.1 uses deterministic bounded min-hash sampling of actual source pixels ≥40 dBZ, across the entire genuine BoM observed echo extent. It renders up to **250 real sampled horizontal columns and 1,500 retained 3-D glyphs per supplemental radar**, with up to three extra sites. Existing points are updated in place when their source category changes, avoiding the double clouds and whole-cloud fade that previously caused flickering. Source 2-D image, Doppler, UTC synchronization and track/cone computations are unchanged.

## Diagnostics and quality gates
The sidebar's on-demand Memory diagnostics now records a per-secondary-site glyph count, in addition to the total supplemental glyph count, so a visible 2-D secondary image with zero inferred glyphs can be distinguished from weather genuinely below 40 dBZ.

A new headless regression checks sparse odd-indexed mosaics (where the old sampling selected zero), geographically dispersed storms, static source-pixel keys through dBZ changes, two distinct supplementary sites, original scan UTC enforcement, in-place primitive reuse, and destruction of deselected radar 3-D geometry.

No release promotion until all repository tests, full Pages dry-run and new static source checks pass. Production must be pinned to a frozen immutable V9.20.1 source SHA; after live verification, an annotated `v9.20.1` tag and `restore/v9.20.1` branch may be created. Existing `v9.20.0`, `v9.19.0` and older recovery refs MUST NOT move.

The original source-facing science is unchanged. Inferred heights remain display-only.
