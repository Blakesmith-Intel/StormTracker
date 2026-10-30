# StormTracker V10.2.35 — four operational menu sections (30 October 2026)

## Exact operator-approved scope
A **navigation-only** rearrangement of already accepted V10.2.34 source controls into four independent, closed-by-default top-level sections:

1. **Radar & Storm Analysis:** Original radar playback and storm tracking controls immediately visible together. Radar/3-D opacity sliders move into optional *Display appearance*. Original track-scope disclosure stays available.
2. **Severe Weather:** Official four-product BoM Severe Weather and Thunderstorm Warnings first, original Flood Gauges second, the genuine-source-only live Cyclones panel third. Original Flood Gauge report, warning Locate/report/manual refresh and live cyclone source-validation controls retained. Flood severity icons and explanations move under a secondary **Flood gauge symbols & severity** disclosure.
3. **Rainfall Observations:** Original significant rainfall switch, reporting-period choices, manual refresh and explicit source/status line, two immediately accessible Rainfall totals and AEP Notable+ reports. Existing rarity and rainfall-colour guide remains independently collapsible, with no change to AEP/IFD calculations.
4. **Community Impacts:** Original road closures, power outage and QFD rescue/assistance map switches and QFD icon legend. Road/outage council explorer shortcut cards stay at the very top of the sidebar with the same live numbers and timestamps.

**Map toolbar outside the four sections:** Original primary radar, additional radars, Reset and Measure controls remain in place. The very same Basemap Street/Satellite select element is moved into a compact **Map style** popup beside the radar navigation (mobile uses a compact icon and five-column fitting), preserving its event listeners and preference handling. No duplicate basemap control.

All four main headings independently open or close; merely collapsing them never toggles a layer, cancels data refreshes, resets map navigation, changes published source statuses, or updates user preferences. No new automatic open/close behaviour, forced active-layer badges, counters or additional source queries.

## Safety and regression protection
- The immutable V10.2.0 production root and already approved V10.2.34 data-science layers remain unchanged; the UI transform runs **after** the accepted, fail-closed V10.2.34 assembly.
- Only existing DOM nodes and compact layout styles are moved; original input IDs, radio/select options, element-bound handlers, report dialogs, flood thresholds, cyclone validity rules and BoM warning negativity/expiry logic remain intact.
- Source-specific refresher cadence stays as accepted: weather warnings 15 minutes, flood gauges approximately 10 minutes and previous cyclone/other source refresh unchanged.
- New deterministic tests validate original control preservation and uniqueness, source status/report placement, correct four-section order, exact map-style select movement, original current-only cyclone panel, all closed-by-default.
- Full frontend suite, review verification and identical pinned production dry-run required. Live public production DOM and interactive iPhone/desktop tests must pass before issuing NEW annotated release tag and restore branch.
- Preserve all existing v10.2.34 and earlier tags/branches.

## Documentation
Updated `docs/OPERATOR_GUIDE_CURRENT.md` for the exact final control hierarchy; new release note, handover and wishlist updates. See `docs/ACTIVE_WISHLIST.md` for outstanding unrelated features, which are deliberately untouched.
