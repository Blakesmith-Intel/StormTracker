# StormTracker — 18 October 2026 flood gauge redesign and strict station-ID joining

## Accepted operational rule

Source: original BoM station observation and classification, matched by exact normalised **BoM station number** (or its source-linked AWRC ID), **never by name**. Especially:
- `IDQ65393.533178` corresponds to original BoM gauge 533178, Mirani Township, Pioneer River.
- Mirani gauge 033152 is a DIFFERENT station; there is no fallback by an overlapping locality name. Unknown and ambiguous station IDs remain unmatched and are counted rather than guessed.
- The metadata `forecast_site_classification` field is **not** used to gate flood marker persistence. Actual values include `data`, `information`, `official`. The previous proposed text "Qualitative" was never present in that actual feed; it is not a reliable operational criterion.

Every gauge with a **fresh BoM-issued classified flood condition** is displayed, including on steady and falling observations, regardless of forecast-site category:
- **Green pin with white water waves:** minor flood
- **Yellow pin with white water waves:** moderate flood
- **Red pin with white water waves:** major flood
- **Blue pin with blue upward-arrow badge:** below minor, but independently measured rapid rise (possible flash flooding)
- **Same blue upward-arrow badge on green, yellow or red:** genuine measured rapid rise while within the respective BoM flood level. This is an inferred screening signature, **not an official BoM flash flood warning**.

The marker's base colour changes when BoM's classification changes. Its arrow changes **only** while currently qualified by successive source-dated observations and the validated rise-rate threshold. A stale historical rise may not keep a badge attached. If a below-minor gauge is no longer rising rapidly, its icon disappears on the next verified refresh; an above-minor gauge remains until an authenticated fresh observation reports below minor or the source is too stale to claim a live reading. An unavailable optional station-history table does not erase authoritative current classification; it also cannot fabricate rapid-rise evidence.

Status counts distinguish flood severity from the extra rapid-rise modifier. The display remains hidden by default as an operator-selectable layer, manual refresh unchanged. Existing 15-minute automatic flood-gauge polling unchanged. Radar/Doppler, storm tracks and current-only cyclone operation remain source-pinned.

## Production/source integrity

The deployment script constructs the public operational root from pinned V10.2.0 radar/3D source and independently tested maintenance overlays. For these fixes, the root now receives all required current modules: `river-gauges-v1.js`, `river-gauge-observations-v1.js`, `river-flood-signals-v1.js`, `river-flood-events-v1.js`, `river-gauge-layer-v1.js`, and current original-BoM history code. Every affected JS module import is cache-busted in the production build; operator legend and public-site smoke tests assert the **actual served source** includes the ID-only join and single arrow marker.

## Tests / constraints

Strict joins for 533178 versus 033152 with swapped observation *names*; reject missing station IDs even for an exact unique locality name, reject duplicate IDs; currently classified minor/moderate/major remain on any trend; below-minor blue candidate only with measured rapid rise; rate expiry/slowdown clears arrow without removing ongoing flooding; source stale/uncertain handling; mock first-bulletin and second-bulletin flow; recovery and expired-state tests; glyph palette and marker SVG content.

The optional BoM recent-history 404/410 response is separately treated as typed `availability:not_published` by the relay, and historic abort errors are recorded as a bounded optional source failure; current bulletins still render. An unrelated radar WMTS 400 was verified as a rejected upstream `dimension (time)`; no unverified frame or radar value is substituted.

**Release gate:** PR frontend, feature, production Pages dry-run and live public Pages checks must ALL pass before this can be described as deployed. A sealed v10.2.2 remains recoverable.

## Addendum — 18 October 2026: Ordinary tidal rise exclusion

**Operational problem:** A river station can be influenced by the tide even when BoM's `location_types` metadata only says `water level gauge;`. The earlier 0.30 m/hour non-tidal screen could therefore show a **blue rapid rise / potential flash-flooding** marker during a completely normal incoming tide.

**Accepted corrected behaviour:**

- Keep all **fresh BoM minor, moderate and major flood classifications** displayed in their green/yellow/red icons at every site, even at sea-level or tidally influenced locations. Never downgrade BoM official flooding based on tidal influence.
- Withhold the **blue inferred rapid-rise arrow** and below-minor blue marker at gauges that BoM explicitly tags `tide gauge`, `tidal`, `estuary`, `estuarine` or `sea level`. Rising tide on its own is not an inferred flash flood.
- Also detect **sustained tidal-like oscillations using a gauge's own BoM station-ID-matched measurements**, independent of its name or whether the metadata correctly labels it as tidal. Require at least 16 hours' coverage and four substantial alternating (rise/fall) limbs; noise and a single flood surge cannot meet this classification. Once a tidal signature is verified, don't display rapid-rise/flash-flooding badges derived solely from water-height rates. A verified BoM flood classification persists.
- Keep 48-hour observation history **only** for confirmed or emergent tide-like stations; retain the 4-hour bounded history for ordinary inland stations to avoid ballooning browser local storage. No extra subscription sources or calls to commercial tides are introduced.
- Normal non-tidal rapid rises still qualify under the original 0.30 m/h observed-rate rule. The original station-ID-only matching, BoM flood classifications, refresh controls and base severity icon colour remain unchanged.

**Scientific limitation:** This is a conservative false-positive screen, not a physical separation of tidal flow, rainfall runoff, storm surge or a compound flood. A tide-affected station without an official tide tag **and without enough source observation history** might initially be ambiguous. Once its tidal pattern is established the rate-only alert is suppressed; continued direct use of the BoM warning product remains essential. A genuine rapid-rise event at a flagged tidal gauge may also be suppressed, but genuine BoM minor/moderate/major classifications remain displayed. This is a sensible trade-off for an awareness platform until a properly sourced station-specific tidal residual/prediction model can be validated.

Test cases model a high-amplitude normal semi-diurnal tide whose rate **exceeds** the inland rapid-rise threshold, both tagged and untagged sources, a real non-tidal fast river rise, and all three official BoM severity levels through steady/rising/falling readings.

Production source contract: the overlay copies the new `river-flood-signals-v1.js` only into the published _site, busts production JS import queries, and asserts `observedTidalOscillation(` and `rateMatches && !tidal` exist in both the built and publicly published source. Historic cyclone QA and sealed V10.2.3 recovery snapshot remain unchanged.
