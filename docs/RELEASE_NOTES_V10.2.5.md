# StormTracker V10.2.5 — Frozen rainfall AEP and catchment release

**Date:** 20 October 2026 (AEST)  
**Production:** https://blakesmith-intel.github.io/StormTracker/  
**Tag:** v10.2.5  
**Recovery branch:** restore/v10.2.5  
**Underlying immutable radar/cyclone source:** `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2` (V10.2.0)

## Accepted scope

- When a live BoM rainfall observation in the selected period reaches 50 mm, display its marker immediately. If the precise 0.025° BoM IFD grid cell is missing, use a source-validated official BoM IFD point lookup to refresh the AEP rarity in the marker and popup. Reuse verified cells; suppress duplicate lookups; allow at most three concurrent requests and retry transient failures.
- Never assign unverified neighbouring-cell AEP values. Keep authentic measured rainfall displayed if the reference is unavailable.
- In the popup, replace the regional map-source label with **Catchment**. Lookup uses the official BoM Queensland rainfall-station register, matching exact station ID and nearby source-published coordinates. Unknown catchments remain explicitly unavailable, not guessed from `widebay` or other regional publication feeds. The original BoM rainfall-map link remains.
- Reuse the source-verified rainfall basin catalogue from the approved preview. Kingull BoM 543013 is Condamine–Balonne.
- Preserve severity ordering, rain icon text size, rainfall measurement categories, BoM observation time windows, and all flood, power, roads, cyclone, Doppler and radar layers.

## Production acceptance and seal

The existing Pages workflow runs full `npm test`, packages the still-pinned scientific V10.2.0 application and this maintenance overlay, checks the new root catchment asset and published runtime, and only then creates an annotated `v10.2.5` tag and `restore/v10.2.5` recovery branch at the deployment source commit. The existing single Cloudflare Worker already provides official point lookup (`/qld-ifd-point`).

**Freeze:** No more development until user feedback is gathered. Retain all older tagged releases and rollback references unchanged.
