# StormTracker V9.20.1 — Secondary Radar 3-D Recovery Patch (16 October 2026)

**Operator feedback:** V9.20.0 removed flicker and reduced reported memory use by approximately 50%, but omitted inferred 3-D volumes for secondary radar sites. A user recording confirmed that those extra sites' 2-D reflectivity remained visible. V9.20.1 restores the secondary-site 3-D coverage while preserving the V9.20.0 low-memory, no-double-cloud renderer.

| Reference | Immutable source commit | Purpose |
| --- | --- | --- |
| **V9.20.1 production source** | `efaceb59427f0b71859b15a61a6758a80d08547e` | Pinned public root, BoM-faithful supplemental source-pixel sampler |
| Annotated release tag | `v9.20.1` | Created only following completed public Pages verification |
| Recovery branch | `restore/v9.20.1` | Pinned to exact production source |
| Historical V9.20.0 | `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1` | `v9.20.0` and `restore/v9.20.0` must never move |
| Historical V9.19.0 | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` | `v9.19.0` and `restore/v9.19.0` unchanged |
| Historical V9.18.0 | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` | Immutable earlier fallback |
| Accepted V9.18 QA | `acfa0ebd3717a793369e3e887e2d1a54785620b7` | Diagnostic preview `/preview/radar-history-fix/` |

## Release guarantees

- Primary and all up to three selected secondary sites retain inferred 3-D for genuine observed reflectivity ≥40 dBZ; BoM original 2-D categories and UTC untouched.
- Secondary 3-D uses deterministic, bounded min-hash sampling across actual observed high-dBZ source pixels, eliminating zero-sampling caused by raw pixel-index modulo and fixed first-scan stride; each secondary site bounded at ≤250 sampled columns/≤1500 glyphs.
- The full accepted V9.20.0 **in-place Cesium glyph updates**, no whole-cloud fades, 3D/2D source-time handover and memory budget remain; no old V9.19 double clouds or cache growth reintroduced.
- All QLD/NSW official satellite coverage, place names, road closure/outage/flood/QFD context, Doppler, storm IDs, +90 min cone safeguards and mobile navigation protections preserved.
- Primary-radar Labels remain off by default, with a primary-only explanatory note; additional-site data does not create unofficial tracks.

## Release management

Public output derives only from `checked/production-v9.20.1` at `efaceb59427f0b71859b15a61a6758a80d08547e`, not mutable main. GitHub Pages validates exact source, public `BUILD.txt`, supplemental sampling module, 2D/3D runtime, and legacy QA. The tag and restore branch must only be sealed after public checks succeed.

See `docs/RELEASE_NOTES_V9.20.1.md`, `docs/HANDOVER_V9.20.0.md` (unchanged base architecture), `docs/USER_GUIDE_V9.20.0.md`, `docs/BASELINE_RESTORE.md`.
