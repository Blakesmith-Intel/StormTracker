# StormTracker — current wishlist after V10.2.26 final documentation freeze

**Status as of 27 October 2026.** Accepted operational V10.2.25 warning implementation is retained unchanged in the V10.2.26 documentation-only release. The immutable V10.2.0 original radar/science pin, V10.2.24 and V10.2.25 restore points remain sealed. [Current operator guide](OPERATOR_GUIDE_CURRENT.md) · [Release notes](RELEASE_NOTES_V10.2.26.md) · [Development handover](DEVELOPMENT_HANDOVER_CURRENT.md).

## Delivered and frozen — no unrequested tinkering

- Authentic BoM native reflectivity/rain radar, multiradar, Doppler, inferred 3-D and operational cone workflows remain as accepted.
- QLD flood gauges, rapid rise, crossing-level persistence, BoM significant rainfall with point-specific IFD/AEP, BoM source timestamps, road closures and road-type reports, Energex/Ergon outage overlays, QFD incidents and LGA reporting remain as accepted.
- **Official severe thunderstorm and severe weather warnings (released V10.2.25):** dedicated opt-in terrain imagery under the radar; BoM `IDQ21035` detailed SEQ versus `IDQ21033` regional QLD product ID filtering; separate product-aware clickable source bulletins and issue/expiry; fully intersecting official LGA/LDMG and DDMG reports with **no minimum overlap**; automatic **15-minute** / manual checks; newer issues replace earlier geometry; confirmed cancellations remove affected polygons; completed verified-empty source distinct from transport errors. The feature is deployed, source-gated, and off by default.
- **Important acceptance boundary:** live BoM geometry has not been observed end-to-end for an actively issued warning. A missing or unavailable genuine BoM polygon must never be replaced by an estimated district map. RSS feed access is not proof of comprehensive active BoM warning coverage.

## Deferred by explicit operator direction

**Official tropical cyclone live forecast map:** defer until a live cyclone exists so geometry can be checked against a genuine current BoM warning product. Existing historical and internal QA references remain untouched. Do not restart repetitive cyclone trials in the absence of a live case.

## Remaining scoped investigations — only on operator request

1. **Real-world live warning acceptance:** when an authentic `IDQ21035`/`IDQ21033` or Queensland severe-weather source product includes its genuine polygon, check origin/provenance, public source completeness, on-map geometry position, update/cancel flow, and all LDMG/DDMG intersections. No artificial warnings in operational production. Confirm any restricted GIS/AXF access separately before relying on it.
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
