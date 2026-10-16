# V10 QA — Radar playback hierarchy and fixed terrain

**Operator direction:** Restore a clean, intuitive sidebar in the isolated `/preview/incremental-3d/` branch. Continue to preserve sealed production `v9.20.2` at `b8be458acbae942a3bb0b530a5c17618b6d03134`. Cyclone development remains paused.

## What changes
- **Radar playback** replaces Watch radar. The frame slider is followed by playback speed, then the selected frame counter and its existing AEST/UTC observation stamp, then Radar opacity and 3-D volume opacity. Keep all original element IDs, original data formatting, source refresh, frame clock and independent Doppler-clock logic. `dualSourceTimes` remains below the two opacity controls.
- **Storm labels & threat cone** becomes a separate card between Radar playback and Layers. Primary radar labels still start off by default and the +90-minute cone remains gated by a single selected track. The primary-only note remains visible.
- **Layers** replaces What to show. Display selection and QFD, flood, road, power controls retain their original handlers.
- **3-D terrain** now always attempts to load at app startup, overriding old browser-stored `off` preferences. The operator checkbox is removed (a hidden disabled compatibility input remains for legacy diagnostics). If the official elevation service fails, the manager may fall back to flat terrain and reports its error; we do not pretend failed elevation tiles are enabled.
- **Flood signals icon:** a vertical red / yellow / green traffic-light icon on the layer option, using exactly the existing map's red major `#e53935`, yellow moderate `#ffd43b`, and green minor / rapid rise `#2db76f`. Blue unusual tidal rise remains noted in the existing severity legend and its original map marker is untouched.
- **QFD icon legend:** an accessible expandable legend in Layers, showing the exact public QFD ArcGIS GroupedType icons for Technical rescue, Road crash rescue and Assist public, with a clearly flagged provisional symbol fallback if QFD's public renderer is inaccessible. Automatically expands when QFD jobs are enabled; no source or icon changes.
- **Simple/mobile:** keep both Radar playback and Layers accessible in the compact internally scrollable sidebar, without resizing the dominant map viewport. Basic play/refresh and incident buttons remain available.

## Regression / acceptance
- [ ] Desktop and iPhone in Simple and Advanced: readouts appear below slider and speed; values update on new frame, pause, Latest and moving the slider.
- [ ] AEST and UTC remain actual BoM source times, never fabricated or recalculated from playback FPS.
- [ ] Rain opacity independent of 3-D volume opacity; Doppler retained full opacity and rain controls do not rewrite Doppler data.
- [ ] Storm labels default off, notes clear, track selector still selects cone and retains primary-only limitation.
- [ ] Terrain loading always attempted after reload even if legacy saved preference was off; geographic camera and satellite/road/flood panels work after changing basemap.
- [ ] Green/yellow/red flood badge visually consistent with original map severity colors; tidal cyan remains explained.
- [ ] QFD public icon key appears on enable, accurate official/provisional attribution; QFD map and marker selection still work.
- [ ] iPhone top controls scroll within existing ~29dvh panel; map remains usable with touch gestures.
- [ ] Full frontend regression, relay syntax and Pages immutable root audit before merging into QA only.


## Operator correction: real status, flood marker style and default-off overlays

- Previous layout created a second frame/time panel while leaving the original green "Frame 2/6 · AEST / UTC · radar tracking history" status at the end of the sidebar. This is **not** the requested move.
- The single original `#status` node has now been physically relocated inside **Radar playback**, after the frame slider and speed, and before the opacity sliders. All original `setStatus(message,kind)` updates continue to target that node; there is no second rendered status. Internal `hybridFrameLabel` / `operationalFrameTime` bindings remain hidden for existing clock consumers.
- Flood gauge icon is now a compact hydrology circle with white water-wave markings and green/yellow/red severity arcs matching the existing real BoM gauge states. It is not a literal traffic light. Cyan tidal screening remains in the existing legend.
- New-session overlay policy: all optional map layers **off by default**, including road closures, unplanned power, flood signals, QFD jobs, storm labels, cones and dormant research overlays. The UI checkboxes start unchecked and the runtime resets their state **before** constructing operational layers, guarding browser-restored form states. Operators can still enable them individually; the sidebar incident counts use the same loaded feed independent of map visibility.
- 3-D elevation terrain remains always-on as requested (except an unavailable-provider fallback / dedicated A/B QA route). Basemap and radar playback are foundational capabilities, not optional incident overlays.
- No modifications to source ingestion, polygon/marker selection, Doppler, inferred volumes or cyclone historical QA.

**Visual acceptance:** In Simple and Advanced, on desktop and phone, check that the status is visible once, directly beneath playback speed; layer checkboxes are all off after a fresh load; enabling each layer works without map click regressions; QFD's independent symbol legend and the professional flood badge remain legible.
