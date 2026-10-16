# StormTracker — Sealed V9.20.2 Recovery and Rollback (16 October 2026)

## Current immutable baseline

`v9.20.2` source **`b8be458acbae942a3bb0b530a5c17618b6d03134`**. Annotated tag `v9.20.2` and recovery branch `restore/v9.20.2` must both dereference to exactly that SHA, created ONLY after successful public GitHub Pages verification.

Expected public marker:
`https://blakesmith-intel.github.io/StormTracker/BUILD.txt` → `SEALED StormTracker V9.20.2 source b8be458acbae942a3bb0b530a5c17618b6d03134`

## Historical immutable release references

| Tag and branch | Exact source SHA | Notes |
| --- | --- | --- |
| `v9.20.1` / `restore/v9.20.1` | `efaceb59427f0b71859b15a61a6758a80d08547e` | Immediate older low-memory fallback (blue NSW imagery gaps) |
| `v9.20.0` / `restore/v9.20.0` | `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1` | Earlier missing secondary 3-D regression |
| `v9.19.0` / `restore/v9.19.0` | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` | Historical full 3-D with higher memory |
| `v9.18.0` / `restore/v9.18.0` | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` | Earlier stable release |
| Accepted `/preview/radar-history-fix/` | `acfa0ebd3717a793369e3e887e2d1a54785620b7` | Historical diagnostic unchanged |

**Never rewrite, move or delete a release tag/restore branch** to roll back. Create a new reviewed cutover branch pointing the public GitHub Pages builder at the requested exact old source SHA, rerun the complete frontend and relay tests, public `BUILD.txt` and asset checks, and confirm the new public output. Archive the rollback as a new release if appropriate.

## Verify the current source

- Source: `/src/context-layers/basemap-manager-v1.js` contains `GLOBAL_SATELLITE_FALLBACK` and `createGlobalSatelliteFallbackProvider`; persistent satellite mode leaves its underlay visible and retains original QLD, NSW, DEA layers.
- Runtime: `/src/live3d-operational-v9.js` imports `global-satellite-blue-gap-20261016-v1`, active persistent 3-D, per-category inferred profiles, secondary coverage and `createResponsiveMemoryDiagnostics`.
- Diagnostics: `/src/responsive-memory-diagnostics-v1.js` provides the viewport-sized modal, Refresh/Copy/Close.
- Shell: `/index.html` and `/live3d-operational-v9.html` refer to `satellite-blue-gap-qa-v1` to avoid old browsers loading a stale basemap.
- Three additional radars have real ≥40 dBZ source pixel volumes and genuine aligned BoM source UTC; no fabricated source frames.
- Original dBZ palette, high-resolution BoM 2-D, terrain, track/labels/cone and source-matched Doppler maintained.

## Next development

Official cyclone forecast geometry → official QLD and radar-covered NSW severe-thunderstorm warning areas → V10 authentic BoM AURA radial wind R&D. Each must use isolated QA and explicit operator acceptance before a new source-pin/tag release.
