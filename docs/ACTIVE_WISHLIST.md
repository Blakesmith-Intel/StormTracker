# StormTracker — active wishlist after V10.2.29 warning layer completion

**Status: 30 October 2026.** The original warning-area wishlist item is marked **COMPLETE**, subject to final website and release-reference verification. The underlying V10.2.0 radar/science baseline and previous frozen references remain unchanged. [Current operator guide](OPERATOR_GUIDE_CURRENT.md) · [V10.2.29 release notes](RELEASE_NOTES_V10.2.29.md) · [Development handover](DEVELOPMENT_HANDOVER_CURRENT.md).

## Delivered and frozen — no unrequested tinkering

- Authentic native BoM reflectivity/rain radar, multi-radar Doppler, inferred 3-D and operational track/cone workflows remain as accepted.
- QLD flood signals, rapid-rise, crossing levels, rainfall IFD/AEP, agency timestamps, roads, outages and QFD incidents, with their existing reports, are preserved.
- **[x] Official BoM Queensland severe warning polygons — completed:** Source-issued `IDQ21033` regional warning areas (`IDQ65654`) and `IDQ21035` detailed threat areas (`IDQ65650`), without artificial geographic reconstruction; independently valid bulletin and polygon times; proper on-map placement above satellite and below measured radar; consistent source-confirmed negative reporting; product-specific filtering; stable camera-controller **Locate**; tap/click polygon to open the exact same LDMG/DDMG report as the button; every official boundary intersection included, no minimum sliver cutoff; 15-minute and manual refresh; source revision, expiry and cancellation lifecycle.
- **[x] Detailed IDQ21035 cell-source integration preconfigured:** The separately specified `IDQ65652` official *storm location* source is queried independently while an actual detailed bulletin is active. Only fresh, source-matched, individual cell geometries can appear. A **VERY DANGEROUS** label requires the cell's own original source record to explicitly assign that designation; blanket bulletin-based labels are prohibited.
- **[ ] Live cell-specific validation remaining:** Government mirror had **zero available `IDQ65652` storm-location records on 30 October 2026**. A future genuine issue is required to validate per-cell identity, location continuity and the Very Dangerous callout on an actual affected cell. This is NOT a currently demonstrated live cell-tracking capability, and the map must not infer storm motion or treat threat polygons as individual cells.

## Deferred by explicit operator direction

**Official tropical cyclone live forecast map:** defer until a live cyclone exists so geometry can be checked against a genuine current BoM warning product. Existing historical and internal QA references remain untouched. Do not restart repetitive cyclone trials in the absence of a live case.

## Remaining scoped investigations — only on operator request

1. **Live individual detailed cell acceptance only:** if BoM publishes `IDQ65652` storm locations in the accessible mirrored GIS layer, verify genuine cell ID continuity, geometry source/refresh and source-attributed **VERY DANGEROUS** callout using an actual current BoM cell. `IDQ65650` threat geometry and `IDQ21033` regional geometry already have independently tested live warning-area display paths. Missing original cell records must not be simulated.
2. **NSW official severe warnings:** still withheld until a verified geographic clip against the real union of installed radar footprints (including Brewarrina, Moree, Grafton and overlapping QLD sites) is available. Never approximate radar extent using a bounding rectangle.
3. **Experimental Doppler severe-wind science:** real BoM AURA sweep decoding, aliasing/georeferencing and historical validation before any straight-line-wind, hook-echo or tornado-candidate indication becomes operational. These are **not official BoM warnings**.
4. **Observed lightning:** not implemented, future consideration only if a reliable no-cost appropriately licensed source is established.

## Permanent non-negotiables

- Never alter the original measured BoM radar resolution, Doppler times, 3-D dBZ thresholds, flood marker styles, IFD/AEP source integration, incident icon sizing or previously accepted operational features without explicit approval.
- Use original geographic source vertices, accurate positions and full original boundaries; the tiny-overlap **“bee's dick principle”** applies to official warning/LGA/DDMG intersections without a minimum threshold.
- Missing, late, malformed, incomplete or unverified data is **unavailable**; no-source is not automatically no-hazard. Expired/cancelled warnings must not remain on the map as active.
- Keep the browser-only design, static GitHub Pages plus the **single existing** Cloudflare relay; no new paid service, unnecessary background tasks or news-media source lookups.
- Existing annotated tags and `restore/*` branches are immutable. Promote only after tests and live website verification, seal a NEW tag/restore pair and document rollback.

Historical original priorities (as at 16 October 2026) are retained in Git history; the above is the current authoritative wishlist.
