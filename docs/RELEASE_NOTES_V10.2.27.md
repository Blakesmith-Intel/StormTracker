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

## Remaining blocker

BoM's publicly available WMO CAP document **does not carry the GIS polygon**. BoM's separate `IDQ65654` AXF source corresponds to the regional `IDQ21033` warning area, but its working unrestricted live geospatial delivery route was not established by this fix. This release repairs truthful feed detection and text metadata and does **not** claim live warning polygon or exact impacted LDMG/DDMG geographic verification.

This limited fix should be used alongside the official BoM warning source until an authentic polygon feed can be connected and independently verified.
