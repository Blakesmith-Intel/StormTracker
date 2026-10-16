# V10 QA — outage LGA verification and suburb map navigation repair

Date: 17 October 2026. Production is **not** modified; production baseline remains pinned to `v9.20.2`.

## Confirmed root cause
The official Queensland AdministrativeBoundaries locality layer is correct and CORS-permitted for https://blakesmith-intel.github.io. A real GitHub Actions network diagnostic using the production origin established:
- `where=locality IN ('ORMEAU','CLONCURRY','GIRU')` responded HTTP 200 with **zero features**.
- `where=UPPER(locality) IN ('ORMEAU','CLONCURRY','GIRU')` responded HTTP 200 with three valid features, including:
  - Ormeau → Gold Coast City
  - Cloncurry → Cloncurry Shire
  - Giru → Burdekin Shire
- Source reports `Access-Control-Allow-Origin: https://blakesmith-intel.github.io`.

The issue was case-sensitive feature matching, NOT lack of official council coverage, and NOT a general browser CORS restriction.

## Repair
- Match uppercase provider locality keys using `UPPER(locality)` in ArcGIS SQL while preserving official council spelling and no guessed mapping.
- Keep a visible council-verification-in-progress status; on panel reopen/manual Refresh retry failed lookups.
- A newer source snapshot arriving during a pending lookup is subsequently processed.
- The suburb name now displays a ↗ marker and is a **map navigation button**. The adjacent disclosure chevron / outage-count still expand the original incident detail table.
- A suburb with one event focuses the original event geometry; multiple events focus a map bounding rectangle containing their published event positions, rather than arbitrarily selecting one.
- The map's existing outage polygon click handlers and original information panels are not changed. An outage display layer disabled by the user is re-enabled through its *existing checkbox listener* when they explicitly navigate to an outage from the list.
- If an outage lacks any actual geometry, map navigation is disabled rather than inventing a position.

## Required QA
- [ ] Open list with a real Queensland feed and confirm council names (Cloncurry, Gold Coast, etc.) resolve on successful official lookup.
- [ ] Test suburb name ↗, chevron expand, one/multiple incidents, existing Details and map polygon clicks.
- [ ] Search locality/LGA before and after lookup completion; spinner/loading and fallback behaviour on feed failures.
- [ ] Confirm mobile/desktop scroll/size and return to the weather map.
- [ ] Verify original rainfall/Doppler playback and persistent legends remain unchanged.
- [ ] Full source pin / frontend / Pages dry-run checks; operator visual acceptance before changing production.

For a reproducible official service diagnostic, run `node scripts/probe-lga-endpoint.mjs` from a network-connected machine. This is deliberately **not** a recurring CI network dependency.
