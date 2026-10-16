# StormTracker — Active Development Priorities following accepted V9.20.2 (16 October 2026)

The operator confirmed the V9.20.2 satellite blue-gap fix and requested sealing and documentation, followed by three separate feature milestones:

## 1. Official tropical cyclone track map (next implementation)

Use genuine current BoM forecast-track geometry or a verified public BoM-derived spatial service. Show official observed/forecast tracks, category, issuance and valid times, uncertainty envelope and watch/warning areas only if that information exists in the real product. No fabricated interpolated fixes. Confirm current-season access/CRS/schema, all available relevant product IDs, no-active-cyclone case, attribution, refresh cadence and expiry. Make it an independent toggle, never force a radar or 3-D redraw.

## 2. Official severe thunderstorm warning regions — Queensland + NSW radar footprint

Use genuine public BoM geospatial warning features, not internally generated storm blobs. Distinguish detailed metropolitan threat map geometry from broad regional thunderstorm-warning polygons. Show official warning source time, threat class, expiry and bulletin click-through. All QLD warnings; NSW warnings only where intersecting installed radar coverage from Brewarrina, Moree, Grafton or Queensland sites reaching south. No QFD-internal GIS-only feed. The warnings overlay cannot be confused with StormTracker primary radar tracking or projected cones.

## 3. V10 authentic AURA Doppler severe-wind science

Access consecutive original AURA volume sweeps in Gympie/Cooloola 24 November 2025 and Christmas 2023 Gold Coast archives; decode radial velocity, georeference, detect aliasing and validate historical events. Yellow potentially damaging straight-line winds, orange hook echo candidate, red tornado/circulation candidate; never label these inferred alerts as BoM warnings without official source.

## Permanent quality and stability requirements

- Native highest available original BoM reflectivity and Doppler source grids; no image downsampling or radar source clock forgery.
- Inferred 3-D storm fidelity preserved, ≥40 dBZ original intensity floor, 1.0× default exaggeration and original dBZ palette; primary and up to 3 secondary volumes must show eligible weather.
- Fixed full width Memory diagnostics, original QLD detail plus regional DEA NSW and world satellite gap fallback.
- No flicker, large camera freezes, deleted WebGL texture use, per-frame unbounded memory, or radar layers with mismatched measured times.
- Live warning data failure must be visible as unavailable, never cached expired warnings misrepresented as valid.
- GitHub Free/static browser, existing Cloudflare transport relay only; no paid weather service requirement without operator approval.
- Production remains the exact sealed V9.20.2 SHA; create an isolated feature preview, obtain explicit operator acceptance, then freeze a new source/tag/restore release.

See `docs/V10_OFFICIAL_WARNING_DATA_PLAN.md`, `docs/NON_NEGOTIABLE_VISUAL_FIDELITY.md`, and the current handover/recovery docs.
