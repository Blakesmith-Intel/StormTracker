# StormTracker QA — Power outages searchable suburb explorer (17 October 2026)

## Operator requirement
Scrolling around the weather map to discover current outages is cumbersome on iPhone. Add a straightforward way to interrogate unplanned power outages from the **sidebar**, sorted by suburb, with expandable details and optional map focus.

## Current implementation
- New **⚡ Outages** button in the existing StormTracker sidebar header, visible in Simple and More options modes.
- Opens a self-contained, keyboard-accessible `<dialog>` with a search field and independently scrolling results. Expand any suburb, then expand an incident inside its accessible HTML table.
- Fields: outage provider, event ID, reported customers, reported streets, reason/status, started time, estimated restoration, official provider link.
- **Show on map** optionally navigates to the centre of the genuine incident GeoJSON location. Navigating first exits the measurement shield if active. Not a promise that the polygon midpoint is a precise premise.
- No change to the existing map markers, live radar, Doppler, inferred 3-D, cyclone historical QA or source polling.
- One transport source: `initialiseOperationalPowerOutages` passes `createPowerOutageLayer`'s existing `onUpdate` array to the explorer. `onStatus` conveys partial/missing feeds, and expired snapshots are removed.
- Search filters suburb name, streets, event ID, status, provider or reason. Initially render up to 60 suburb groups, with **Show more** to prevent browser overload.
- Multi-suburb provider incidents appear under every named suburb; customer counts apply to the whole incident, **not** to each displayed suburb. Distinct event count is deduplicated by qualified outage ID. Missing SUBURBS remains an explicit 'Suburb not supplied' group. No fabricated suburb assignments or geocoding.
- True source scope remains existing Queensland-only unplanned Energex, Ergon and appropriately filtered Essential Energy feeds. Planned outages remain out of scope.

## Testing / acceptance
- `frontend/tests/run-power-outage-suburb-explorer-v1-tests.mjs`: splitting and preserving multi-word suburb names, duplicate event IDs, provider scope, source-only UI and location validity.
- Full `npm test`, relay checks, source-pin Pages dry run before merging to QA branch.
- Operator mobile and desktop visual test: open dialog; type suburb; expand; view detail; close; Refresh; tap Show on map; no clipping; Simple/More options accessible.
- Partial failure or expiry must be explicit and must not imply all regions/providers are accounted for.
- Only isolated `/preview/incremental-3d/` changes. Live root production remains pinned immutable **V9.20.2** SHA `b8be458acbae942a3bb0b530a5c17618b6d03134`. Never promote without operator acceptance.

Cyclone feature development remains paused.
