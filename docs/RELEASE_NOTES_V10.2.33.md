# StormTracker V10.2.33 — Severe Weather and Situational Awareness navigation (30 October 2026)

## Approved operator changes
1. Rename **BoM severe warnings** to **BoM Severe Weather and Thunderstorm Warnings**, keeping the original enabled checkbox, genuine issued warning polygons, four IDQ product filters, Locate, manual refresh, source status, and LDMG/DDMG report unchanged.
2. Add a **separate top-level expandable Severe Weather** sidebar section, closed by default, without changing the state of any existing map layers.
3. Move intact the **Flood signals/gauges** checkbox, full severity legend, report and 10-minute/manual refresh and the **BoM warnings** section into **Severe Weather**.
4. Move **Cyclones** into **Severe Weather** and present its real current-source controls **inline in the sidebar** when expanded, instead of in the separate floating panel. The original cyclone live checkbox, source selection, manual refresh, source-verification status, issued forecast focus and live 5-minute polling (when opted in) are preserved. The existing source remains internal/access-controlled; public page must never pretend a feed is available or produce a false "no cyclone" status.
5. Rename the previous top-level **Layers** heading to **Situational Awareness Data**, retaining the original basemap, rainfall/AEP, roads, outages and QFD incident controls.

## Implementation limits
The immutable V10.2.0 baseline and all related scientific / operational source files remain untouched. The production build assembles the original approved source and applies `scripts/apply-severe-weather-sidebar-v1.py` only after stripping historical cyclone QA fixtures. It moves the original DOM controls **without duplicating or renaming IDs**, retains all input defaults/listeners/cadences, and adds only the `frontend/src/severe-weather-sidebar-v1.css` scoped presentation. Before publication it checks each original control appears exactly once and the cyclone panel is *current-only*; unexpected source shapes fail closed. Existing preview/historical QA trees are not modified.

## Acceptance
- Full frontend suite, including the deterministic five-change regression `run-severe-weather-menu-hierarchy-v1-tests.mjs`.
- Production Pages dry-run using the unchanged baseline, then successful production Pages deploy and public DOM/CSS verification.
- Browser-interaction checks of collapsed/expanded Severe Weather, renamed Situational Awareness Data, warnings and flood controls remaining accessible, and Cyclones opening and closing inline without moving the map.
- Operator guide, handover, release notes and wishlist updated.
- On successful public acceptance only, seal NEW annotated `v10.2.33` and recovery branch `restore/v10.2.33`, keeping `v10.2.32` and all earlier recovery references unchanged.

**No weather-data, radar, Doppler, rainfall IFD/AEP, flood thresholds, warning feed, operational incident, cyclone validity or camera-engine changes.**
