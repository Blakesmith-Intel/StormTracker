# StormTracker V10.2.36 — unified Cyclones subsection and independent concurrent cyclone maps (30 October 2026)

## Operator-requested improvement

The existing **Severe Weather → Cyclones** subsection now aligns with other controls: its original **Show live cyclone forecasts** switch and the **one original live source/status message** are visible directly beneath the Cyclones heading, with a compact **Details / Hide details** expander. The original source refresh, selected-source dropdown, Focus cyclone action and official BoM link remain inside Details. The panel is always inline in the sidebar, never floating over the map. The accepted V10.2.35 four-section layout, radar/Doppler, rainfall/AEP, flood, QFD, road closure and outage controls do not change.

## More than one active cyclone, each with its own map and warning-provenance link

The already accepted internal BoM GML schema supports several separately identified, genuine current cyclone forecast systems. Previously only the currently selected cyclone was drawn. The V10.2.36 UI can list **every source-qualified cyclone** as an individual system card, showing:
- Original BoM cyclone name, forecast product ID, **issue** and **expiry** times (AEST).
- An independent **Show issued track** map checkbox per cyclone. A new genuine system defaults to displayed; a previously hidden system remains hidden across a subsequent successful refresh when its unique source system ID persists. Several selected issued tracks and source-geometry likely-tracks areas can appear on the shared map simultaneously without fabricating forecasts.
- An individual **Focus [cyclone]** action calling the original guardian-compatible camera controller with source-valid original geometry, not raw Cesium flyTo.
- A **warning provenance notice** plus an official BoM tropical cyclone warnings link for that individual system. **The issued forecast GML does not include its independent current warning bulletin**, so the app does **not** fabricate a per-system watch/warning, cancellation, warning area or severity status. The user must verify separately issued BoM warnings. These links are source-navigation only, not proof that a current warning exists.
- Original selected-system source selector and shared Focus remain as before.

## Safety and source integrity

- No additional feed or source request. The original authenticated same-origin `/internal/cyclones.json` may be unavailable on public GitHub Pages. It must never be substituted with dummy data or interpreted as a confirmed all-clear. Existing status semantics are preserved: **Currently no tropical cyclone warnings** is reserved for a fresh **complete** manifest with no active products; **Unable to verify** is shown on any other unconfirmed source failure.
- Original server-side entitlement requirement, `validateInternalCycloneSnapshot`, full source SHA/product checks, expiry constraints, source-clock freshness and 5-minute enabled-layer polling are **unchanged**. Multiple systems are independently validated within the original strict feed (max five products), not geospatially inferred.
- When disabled/cancelled/unverified, all per-system cards and original map entities are cleared. Source-specific forecast identifiers are preserved for each geometry, and no original warning polygons are invented.
- UI changes are applied **after** the existing pinned V10.2.0 production assembly and accepted V10.2.35 four-section transform; only existing compiled current-only cyclone modules and scoped CSS change. No other weather component is patched.

## Verification and restoration

- Full frontend regression suite plus `frontend/tests/run-cyclone-inline-multisystem-v1-tests.mjs` (runs `scripts/test-cyclone-subsection-v1.py`) validating exact original source/DOM contracts, dual-source rendering loop, source expiry, links, map focus and JavaScript syntax.
- Exact production Pages dry-run and repository review required.
- After deploy, public Pages HTML/CSS and real mobile/desktop browser smoke tests required. Where the public source is inaccessible, test actual negative-source behaviour without making any false current-warning assertion. Separate **isolated browser simulation** with two synthetic, validly structured issued systems may test card counts, independent controls, multiple track stamps and Focus, but is **not operational cyclone data**.
- Operator guide and one-page **StormTracker Quick Reference V10.2.36** PDF delivered. Sealing requires a new `v10.2.36` annotated tag and `restore/v10.2.36` branch after acceptance; `v10.2.35` and every earlier frozen tag remain untouched.

**Caution:** The current cyclone forecast source is not itself a separately verified cyclone-warning product. Do not claim that individual warning bulletin ingestion has been completed.
