# V10 QA: compact storm controls, one radar time, live incident refresh stamps
Date: 17 October 2026. **Only development preview**. v9.20.2 remains sealed as production. Cyclone scope unchanged (paused).

## UI changes
- The original `#status` remains the single operator-facing frame counter, radar/AEST/UTC time and tracking status in Radar playback.
- The **white Radar timestamp immediately beneath it** (the `#radarClockGroup` inside `#dualSourceTimes`) is now hidden from display. Its original `#radarPlaybackTime` binding remains available to the independent radar/Doppler comparison logic; the independent Doppler clock is still visible when selected. No radar clock calculation changed.
- Storm tracking is now two small control rows: Labels plus Details; track selector plus +90-minute cone. The primary-radar-only explanation sits in a closed `<details>` labelled Track scope. All original control IDs/handlers and threat cone status remain.
- Constrained desktop windows use a compact section density and a viewport-bounded sidebar with **internal scrolling as fallback**. The app itself should not extend below the window, nor overlap the map; the entire content cannot literally fit vertically at every possible browser height.
- Both full-width incident buttons now show `Last refreshed HH:MM AEST` from the most recently **successful** official source fetch (`loadedAt`), never from page creation or a status re-render. If a refresh fails or the snapshot expires, the button reports that and retains the last successful time instead of falsely looking live.

## Data freshness vs display visibility
All optional map overlays remain **off on page load**. Previously this also suppressed the initial and periodic outage/closure fetch, leaving sidebar counts stuck on Checking. The layers now accept opt-in `refreshWhileHidden` (default **false**, to preserve existing users), enabled **only** by the operational power-outage and QLDTraffic adapters:
- Initial fetch while hidden, existing refresh interval while hidden, and visibility-return refresh. All use `refresh({force:true})` only to fetch the underlying source; `dataSource.show` remains **false** until an operator checks the layer.
- Existing live incident counters, LGA-grouped lists, official polygons and map selection are not reimplemented. There is no second independent polling loop.
- Last successful source stamp updates only when the provider adapter signals a snapshot `loadedAt`; failed/expired events do not stamp new times.
- All source expiry and failure handling remains operative; displaying a time is not a guarantee that upstream feeds cover every provider.

## Acceptance
- [ ] Desktop: original green status appears once; the extra white Radar time under it is gone. Doppler source time only shows where relevant.
- [ ] Desktop normal/short windows: compact tracking section, no sidebar-map overlap, internal scroll only when the viewport is too short; all toggles and controls reachable.
- [ ] iPhone: all controls remain touch-friendly; map keeps dominant size, sidebar scrolls.
- [ ] Page loads with power, road, flood, QFD and storm label overlays hidden; outage and road *counts* still load, and each button shows an actual last-successful HH:MM AEST time without enabling map layers.
- [ ] Refresh each incident feed manually and observe a newer successful time; failed/expired attempts show honest status, no invented freshness.
- [ ] Verify power/road marker clicks, council navigation, live BoM Doppler, source legends, radar and 3-D volumes unaffected.
- [ ] Full CI, Pages pinned-production audit and operator visual sign-off before production promotion.
