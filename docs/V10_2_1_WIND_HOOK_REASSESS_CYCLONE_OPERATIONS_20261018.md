# StormTracker — 18 October 2026 radar science re-evaluation and cyclone operational isolation

## Source and baseline evidence

- **Most recent sealed maintenance snapshot:** annotated `v10.2.1` / `restore/v10.2.1`, commit `f142018fde8e252b8426591a339d32a13c59d46c`. Preserve immutable `v10.2.0` and earlier rollbacks.
- Verified `frontend/src/live3d-operational-v9.js` at `f142018...` is **byte-identical** to the immutable V10.2.0 runtime `047b3bd1...`. The morning's maintenance instead updated the BoM recent-river parsing and bounded relay, river/flood-gauge layer, manual refresh, and power-outage terrain-safe styling. It did **not** replace source Doppler frame selection, native projection, selected-site UTC, ST storm tracking, or beam radial-velocity semantics.
- **V10.3 wind/hook science** remains in the separate pinned `/preview/wind-hook-v10-3/` route (source `f3a07688ca02f5f0234ae6425fc1177722518c53`). It already requires two original sequential Doppler scans for **yellow** and **red** wind evidence. **Orange** reflects persistent observed hook shape only. No scientific grounds to change thresholds or mark image speeds as damaging 90/125 km/h surface gusts based on this morning's flood-gauge/outage fixes.
- Its preview still carries older flood/outage context-layer copies. Before promoting **any** V10.3 science or site-mechanics improvements to production, rebase and rerun the latest V10.2.1 context-layer/relay and multi-site regression suites; preserve the `analysisGeorefVerified` radar-site whitelist and never enable Brewarrina's provisional Doppler georeferencing for velocity/circulation science. The V10.3 research preview is not a production warning source; historical AURA sweep and false-positive validation remain pending.

## Cyclone correction in production packaging

The original V10.2.0 UI imported `createHistoricalCycloneForecastQA` in the **live browser runtime** and shipped its archived case/buttons, original sample GML file uploader and Fina example in the operational map. That can mislead users during actual cyclone warnings and has no place in a current situational-awareness layer.

The updated `scripts/build-current-site.sh` now calls `scripts/strip-production-cyclone-qa.py` **only on the production `_site` tree** after the already sealed morning flood/outage fixes are applied. That source-guarded step:

1. Removes the archived historical cyclone module import/mount, original Jasper/Alfred buttons, Fina sample description, archived map stamp, GML file uploader and stale-historical QA status from operational HTML.
2. Mounts `createOperationalCyclonePanel` and the existing current-source BoM GML/browser handler only on the operational root/direct HTML, no archived overlay.
3. Excludes old archived cyclone decoder/overlay/replay modules and `data/cyclone-history` from the production root. Rewrites index and operational HTML source-cache identifiers to prevent cached UI return.
4. **Preserves all historical files and QA controls in the separate** `/preview/incremental-3d/` and `/preview/wind-hook-v10-3/` site trees. Never deletes their original repository files.
5. Fails the build if the source/HTML contract has changed; checks JS syntax, retained BoM current-product class, absence of historical buttons/modules/data, and public Pages post-deployment source.

All other production runtime code (radar, Doppler, 3D, map, power outages, manual 15-minute flood-gauge polling, QFD and incident sources) remains untouched.

## Critical remaining cyclone ingestion boundary

Current-source cyclone **UI** is not the same as functioning live BoM data ingestion: the browser's `/internal/cyclones.json` source remains unconnected on GitHub Pages. An unavailable feed must display **unable to verify warnings**, NOT falsely show **currently no warnings**. This cleanup removes obsolete and misleading **historical examples** but does **not** implement an FTP-to-HTTPS relay or bulletin/GML association. Treat a live cyclone feed as a separately testable milestone.

## Release acceptance

Green frontend tests plus full immutable-root build; verify published root app has no archived imports/case references, no history JSON, and current BoM panel still mounts. Verify the two reference previews retain original data and retain valid byte/source hashes. Tag a new maintenance release only after live publish smoke checks; never repoint `v10.2.1` or `restore/v10.2.1` or change the accepted radar core.
