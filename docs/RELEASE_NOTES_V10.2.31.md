# StormTracker V10.2.31 — BoM current-warning negative reporting and issued-polygon synchronisation (30 October 2026)

## Operator-verified incident
At 7:44–7:45 pm AEST, the UI reported active IDQ21033 with no spatial polygon, and IDQ21035 as “unable to confirm current warnings.” At 7:48 pm AEST, live official checks found a newer IDQ21033 bulletin issued 7:38:54 pm and two original IDQ65654 polygons issued 7:38:48 pm, while the official Queensland warnings summary listed IDQ21033 but **not** IDQ21035. A temporary publication delay in source geometry is not a cancelled warning. The incomplete 22-alert WMO history sample is not an adequate proof that no separate warning product exists.

## Fix
- Independently fetch BoM's official **Queensland Warnings Summary** as a current-product index from the existing Cloudflare warning relay, alongside the international CAP feed.
- Parse only a fresh, correctly structured summary with a specific BoM-generated UTC timestamp and actual current-product links. A valid absent product now yields **No current warnings**, even when the international RSS search is intentionally limited. Stale, malformed or inaccessible listings do **not** authorize negative reporting.
- An authentic active CAP bulletin remains active even before updated geometry arrives. Explain it as **awaiting updated BoM polygon** rather than as an unexpected error. A product listed active by the official current summary while its CAP is missing from the bounded sample is explicitly **current; polygon awaiting verification**, never “no warnings.”
- Retain source-specific original geometry validity, individual cancellations and 15-minute/manual checks. Never keep superseded geometry, infer geography or display a bogus shape.
- Do not upgrade issued severe-thunderstorm hazard wording solely from separately reported observations. The 7:38 pm IDQ21033 warned for heavy rainfall but noted locally intense rain **already reported**; that observation must not mark the entire warning as **HIGH-END: Intense rainfall** unless the actual warned phenomenon or explicit hazard code warrants it.
- No change to radar, Doppler, IFD/AEP, flood signals, incidents, roads, outages, basemap, camera or reports.

## Acceptance and restoration
Deterministic tests cover fresh actual BoM index HTML markup, obsolete/stale indexes, no-current versus incomplete CAP data, a source-verified active bulletin with delayed geometry and separation of observational versus forecast hazard language. A 30 Oct 7:57 pm live source check verified the candidate parser: IDQ21033 active in the official list; IDQ21035, IDQ21037 and IDQ21038 absent. Full pinned site and existing relay must be verified after deployment. Preserve immutable `v10.2.30` and earlier tags. New recovery reference only after public production verification.
