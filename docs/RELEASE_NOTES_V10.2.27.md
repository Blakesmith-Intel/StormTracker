# StormTracker V10.2.27 — live BoM IDQ21033 CAP source correction

**Date:** 28 October 2026 (Queensland AEST).  
**Scope:** Isolated BoM warning status/metadata recognition and operator feed visibility. No changes to radar, Doppler, inferred 3-D, flood gauges, BoM IFD/AEP rainfall, road closures, outages or QFD incidents.  
**Previous immutable restore:** `v10.2.26` and `restore/v10.2.26`. New tag/restore reference sealed only after actual site and Cloudflare relay verification.

## Actual live bug demonstrated on an official BoM issue

At **28 October 2026, 7:45 pm AEST**, the official WMO-hosted Bureau CAP distribution included `AusBoM-IDQ21033-2026-10-28T09:45:52+00:00`, an `Update` to regional Queensland severe thunderstorms. A live GitHub Actions source probe confirmed:
- CAP sender `CAP.Message@bom.gov.au`, `status=Actual`, `event=Thunderstorm` and a **headline expressly identifying a Severe Thunderstorm Warning**.
- Issue and expiry times plus genuine warning description, safety instructions and Queensland forecast district descriptions.
- **Zero `polygon` and zero `circle` elements** in the full CAP XML. This is a source omission, **not proof that the active warning has been cancelled**.
- The CAP's `web` field links to a generic HTTP BoM national index. The specific, user-confirmed official bulletin location is `https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033`.
- Direct `www.bom.gov.au` automated runner requests returned HTTP 403. The independent WMO official CAP feed succeeded with HTTP 200.

Previously StormTracker required the CAP `event` to be literally `Severe Thunderstorm Warning`, and required original polygons and an HTTPS BoM bulletin link. Thus the active IDQ21033 CAP was silently rejected.

## Delivered fix

- Accept original-source `event=Thunderstorm` as an **official severe warning only** when the CAP is confirmed `Bureau of Meteorology`, the original product identity is exactly an allowed BoM `IDQ21033`/ `IDQ21035` code, the headline specifically says severe thunderstorm warning, and the issue/expiry/status are valid.
- Identify the newest warning by genuine issued time. Show **ACTIVE BoM warning — original polygon unavailable**, rather than incorrectly reporting `0 active BoM warnings` or a confirmed cancellation.
- Carry the original headline, issue/expiry, description, safety advice, affected forecast district descriptions and product-specific official BoM link to the **LDMG/DDMG report** so the warning remains visible when no source geometry is supplied.
- **Do not generate polygons from district names**, weather radar, broad boundaries, centroids, or forecast-area buffers. Without a genuine original geometry the affected LDMG/DDMG list cannot be calculated to the operator's all-intersections ('bee's dick') accuracy requirement, and the UI states this.
- Retain 15-minute refresh and immediate manual refresh; preserve explicit cancellation and superseded issue handling. Unavailable sources remain visibly unavailable rather than claiming an all-clear.
- Run the real-issue source probe, existing frontend regressions, and production-package dry-run before merge. Verify live published relay data and browser output after promotion.

## Authenticated original BoM geometry — resolved using QDMA access

The operator has confirmed StormTracker is used by a **QDMA registered team** directly working with BoM, and that the authorised government data access is permitted. A real-time source check found the public Queensland emergency-management **BoM Land Warnings RO** GIS2Web/WFS-derived feature service. Its official thunderstorm layer (FeatureServer layer 3) was returning four current genuine **`IDQ65654`** source polygons for bulletin **`IDQ21033`** with `validfrom_utc=2026-10-28T09:45:52Z` and `validto_utc=2026-10-28T12:45:52Z`, exactly matching the authentic active WMO-BoM CAP issue and expiry.

StormTracker now queries this precise BoM-source geospatial product through its existing Cloudflare relay and joins each individual shape to the authenticated BoM CAP warning by **exact product ID and source issue/expiry time**, allowing a two-minute tolerance for source timing variations. Original geographic coordinates are preserved, not simplified to a district or fitted polygon. The real geometry is passed through the existing `esriSpatialRelIntersects` government LGA/DDMG queries so even tiny spatial overlaps are included. The detailed SEQ `IDQ65650` product has no current polygons in the verified source sample, which is distinct from regional `IDQ65654`.

If the approved government spatial feed becomes unavailable, no artificial polygon is substituted and the official CAP text stays visible with a geometry-unavailable state. Original warning cancellations, superseded issue and 15-minute/manual refresh semantics are unchanged. The government WFS-derived mirror is explicitly identified as such and never represented as direct CAP polygon content.

**Data scope:** BoM weather warnings only, restricted to the QDMA-appropriate government-published replica. No other GIS, storm-science, AEP or operational layers are modified.

## Remaining blocker

None for the demonstrated source-exact active `IDQ21033` warning; the live WFS-derived polygon service is accessible and matched to the issued BoM CAP product. Any future product without fresh geometry must still explicitly report the source limitation, and operators should retain BoM's source link for decisions.

