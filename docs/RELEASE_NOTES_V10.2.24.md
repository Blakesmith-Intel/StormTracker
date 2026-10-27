# StormTracker V10.2.24 — operator-approved live production restore point

**Operator acceptance:** 27 October 2026 (AEST)  
**Live site:** https://blakesmith-intel.github.io/StormTracker/  
**Operator guide:** [current site-linked guide](OPERATOR_GUIDE_CURRENT.md)  
**Restore references:** new immutable **annotated tag** `v10.2.24` and **restore branch** `restore/v10.2.24`, created **only after successful Pages deployment and public-site verification**, both pointing to the exact release commit. Existing tags and restore branches are never moved.  
**Source composition:** sealed native V10.2.0 weather/radar/science foundation (`047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`) with accepted maintenance overlays compiled by `scripts/build-current-site.sh`. Do not confuse the permanent BUILD.txt *foundation pin* with the *composite production source* at this tag.

## Accepted operational functionality

- Latest QLDTraffic **Road types report** is accessible from the existing **Road closures by LGA** dialog. All unplanned road closures **to all traffic** are partitioned into **state-controlled/highways/motorways**, **local government**, and **classification unverified**. Each event is counted once and can be expanded by council, searched and opened at its original QLDTraffic map location.
- Ownership categorisation uses the exact incident ID from the QLDTraffic operational-status and state-highways HTML reports. Unavailable, conflicting or unmatched evidence remains **unverified**. Classification does **not** invent a road authority, remove road closures, re-map road geometry, or expand the allowed event feed.
- The user-approved flood-gauge logic includes current exact-ID **approaches/road approaches, bridge, causeway, crossing** references; stage colour priority; historical measured depth above a road reference with the authentic source observation time and stale warning; measured rapid-rise independent of BoM textual tendency; exact-station coastal tidal screening and original recovery/expiry rules.
- Agency-source-appropriate timestamps are used in hazard info panels. BoM 50+ mm rainfall and exact-site IFD/AEP rarity, verified gauge and road locations, provider power outage geometries, QFD incidents, and the accepted radar/3-D/multi-Doppler playback remain as previously approved.
- Existing map markers, severity layering, data-refresh intervals, radar imagery, frozen earlier source pins, CSS placement and unaffected navigation controls remain unchanged.

## Safe restore and production identity

1. Verify that GitHub Pages **deploy** and its independent **Verify published V10.2.0 source and existing historical QA** step succeeded for this precise composite commit. Check that the published site contains the road report and that the Cloudflare relay's `/road-ownership-report` transport is reachable. Its **live classification** depends on the two external QLDTraffic reports; a failure to load either must keep unmatched closures unverified.
2. Only then create `refs/tags/v10.2.24` as an **annotated** tag peeling to the exact deployment commit, and `refs/heads/restore/v10.2.24` pointing at the same commit. Verify both refs match. **Never update older release refs, including `v10.2.23`, which may already point to an older source.**
3. To roll back, review the archived release source at `v10.2.24`, run the standard production build/tests, and redeploy the resulting composite using a new reviewed change. Never force-push or repoint a sealed reference.
4. A Git tag pins the repository source and build manifest **but not** external, changing BoM/QLDTraffic data, Cloudflare's independently deployed worker version, GitHub Pages service state, or the `radar-ftp-feed` branch. Audit the Worker deployment separately before claiming a complete external service rollback.

**Out-of-scope for this freeze:** any additional new roadmap features, changes to radar or flood science, new third-party paid feeds, or overwriting historical release references.
