# StormTracker V10 — single simplified operator interface (QA, 17 October 2026)

## Operator decision
The recently accepted simplified UI is the **only** supported operator interface. Retire the old expanded layout previously accessed through **More options**. Keep the accepted radar playback, storm tracking, layer selection, power and road LGA incident explorers, customer counts, AEST refresh times, always-on terrain, map measurement, radar/Doppler legend and multi-radar navigation.

## Dependency audit and elimination
| Previous advanced interface element | Action | Runtime dependency resolution |
| --- | --- | --- |
| More options / Simple view switch | Removed from HTML and measurement tool | `createFriendlyMapTools` no longer requires an expanded-mode button or changes modes |
| Old operational overview card | Removed | Renderer metrics use a single headless `#runtimeDiagnostics` store of read-only outputs, never a second operator page |
| Layer refresh buttons only exposed in expanded view | Removed | QLDTraffic, electricity, flood and QFD adapters already attach optional refresh handlers; polling and toggles continue independently. Power and road explorers retain their explicit Refresh actions |
| Extra basemap, terrain, road, power, river and QFD status rows | Removed from sidebar | Read-only status destinations moved to headless diagnostics, preserving upstream error/status handling; no terrain checkbox or handler remains |
| Separate auto-refresh notes | Removed from sidebar | Their text destinations moved to headless diagnostics |
| Inference switch in expanded Layers | Removed | Storm **Details** still opens the standalone dialog and can select Tracks / Inference / Model / Sources tabs |
| Rounded-volume checkbox in expanded Layers | Removed | Renders the previously accepted rounded 3-D volumes unconditionally |
| Disabled research-only storm switches | Removed | Experimental alerts remain disabled; no visible operator toggle or readback dependency |
| Historical cyclone QA embedded in expanded sidebar | Auto-mount removed | Module retained for future cyclone test work (cyclones remain paused); does not mount extra UI or fetch/replay historical cyclones during normal weather viewing |
| Responsive style split between Simple and Advanced | Advanced toggling and hide/reveal selectors removed | Static `simple-ui` stylesheet class now identifies the single supported UI, with an explicit `single-interface-v1.css` viewport contract |

The *storm Details dialog* is **not** the old expanded sidebar; it is a direct, already approved function accessed from the compact Storm tracking card and therefore remains intact. The read-only headless diagnostics are not operator controls. New development must not use them to resurrect an expanded UI.

## Validation / operator signoff
- [ ] No More options or Simple view button on desktop/iPhone; no alternate interface to switch into
- [ ] Sidebar remains fully scrollable within window while map remains usable, with previous card hierarchy, fonts and controls
- [ ] No missing DOM IDs or JS exceptions on app load, radar selection, rain/Doppler, autoplay, scrub, labels, threat cone, opacity, basemap or terrain
- [ ] Power/road LGA dialogs, customer counts, live last refresh, and map navigation unchanged
- [ ] QFD, flood, power and road map toggles, 3-D storm rendering, measurement, map scale and radar legends unchanged
- [ ] Storm Details dialog Tracks, Inference, Model and Sources tabs still function
- [ ] Automated regression tests, Pages sealed production package, and operator browser acceptance

Production **V9.20.2** stays sealed at `b8be458acbae942a3bb0b530a5c17618b6d03134` until browser acceptance and a separate promotion decision.

## Final orphan-control cleanup (17 October 2026)
The otherwise-retired hidden `#terrainEnabled` checkbox and its JavaScript readback were removed from the headless diagnostic store, along with obsolete terrain/volume sidebar CSS selectors. Terrain initialises directly using the existing terrain manager; the old checkbox cannot gate it. The isolated `/preview/street-flat/` performance-test path is retained for technical comparison only. `#terrainStatus` remains a read-only diagnostic result. The UI contract test now rejects the removed checkbox and JavaScript references. The map-measurement, production source pin and historical cyclone data are unchanged.

## Multi-site native Doppler fix (17 October 2026)
The additional-radar selector also drives independently sourced BoM Doppler imagery during Doppler-only playback, limited to verified-supported product sites. Each supplemental scan has its own original UTC and palette, aligned within eight minutes of the primary Doppler frame. Unavailable or mismatched frames are omitted rather than fabricated. Native pixel RGB is preserved, and the source-time diagnostics appear inside the radar chooser. Each site has bounded record cache and a single coalescing preparation path to prevent rapid-scrub request pileups. Primary remains the only storm-tracking/3-D science source. NSW Brewarrina Doppler remains excluded pending geographic verification, and Moree/Grafton have no verified Doppler product.

Final mode-change safeguard: switching from Doppler to rain immediately retires every secondary wind layer before asynchronous radar loading starts; stale native layers cannot linger during source changes.

## Doppler multi-site playback refinement · QA branch only · 17 October 2026
A phone recording of the south-east Queensland three-site wind display showed pronounced patch changes during playback. The initial V10 implementation decoded each additional genuine BoM Doppler source asynchronously, then switched a site at zero transition time. This isolated QA now stages secondary wind with a short 120 ms existing-style top-only handover, warms one upcoming authentic UTC scan per site, and limits repeated failed BoM history/image requests to 60-second per-site/source retry intervals. It does **not** smooth source velocities, blend radial measurements between different radars, infer missing wind, rewrite the original palette or change the 8-minute source tolerance. Source clock and masks remain truthful. V10.0.0 immutable production is not modified until an operator visual pass.

## Brewarrina Doppler and NSW rain-only classification · 17 October 2026 · QA
BoM officially describes Brewarrina as C-band Doppler/dual-polarisation radar and publishes IDR93I 128 km radial-velocity imagery. Primary and extra-site selectors now identify it as Doppler capable. BoM's published radar latitude -29.96°, longitude 146.81° and 128 km wind product define the 512×512 Gnomonic grid centred on (256,256); source-pixel-to-geographic and inverse mapping are validated with independent cardinal-range/centre/round-trip tests. This is the current nominal map alignment, not verified with measured control points from an authentic IDR93I weather scan; `analysisGeorefVerified=false` remains. Moree 53 and Grafton 28 have BoM reflectivity only and now explicitly show **Rain only** rather than **Doppler pending**. Brewarrina IDR93I uses the same approved production Cloudflare relay as Queensland; live BoM upstream access and actual source-image alignment still require confirmation before production promotion.

## Multiple native Doppler site synchronization · 17 October 2026 · QA
The chosen primary wind radar remains the **sole measured UTC playback clock**. Each additional site chooses its own closest actual BoM scan within **8 minutes**. Previously, secondary imagery started preparing only **after** the primary image had fully committed, producing visible asynchronous coverage changes. The same source-time frame is now requested from all additional sites **in parallel with** primary scan preparation, and the clock waits no more than 160 ms for this best-effort preparation before committing the primary. The short 120 ms staged secondary transitions are unchanged. If a station does not reply in time, it finishes later (or is omitted), without freezing playback or fabricating observations. The existing Doppler site status now reports the signed difference in minutes of the *actual displayed secondary* scan compared with the primary UTC, so a user can spot an older source instantly. This is a bounded best-effort synchronisation, **not an atomic guarantee of equal source times**; the BoM sites publish independently and may not offer identical timestamps. Immutable V10.0.0 production remains pinned.
