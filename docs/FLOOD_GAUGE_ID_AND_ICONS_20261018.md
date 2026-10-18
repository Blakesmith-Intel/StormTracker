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

## Addendum — statewide 2026 tidal-rate reference (subsequent sensitivity revision)

**Reference data:** Maritime Safety Queensland, *2026 Semidiurnal and Diurnal Tidal Planes* (Tidal Datum Epoch 2010–2029), at https://www.msq.qld.gov.au/tides/tidal-planes . Twelve geographically distributed standard-port reference locations are included, with spring-high to spring-low values: Gold Coast Seaway, Brisbane Bar, Bundaberg, Gladstone, Rosslyn Bay, Hay Point, Mackay Outer Harbour, Townsville, Cairns, Thursday Island, Weipa and Karumba.

**Derivation:** For each semidiurnal site, take `MHWS-MLWS` and use the simplified sinusoidal *peak rate* = range × π / 12.42 h. For the three northern diurnal reference sites, take `MHHW-MLLW` and use range × π / 24.84 h. This is a **reference model, not measured instantaneous water rise nor a literal statewide observed mean**. The mean among these 12 equal-weight *modelled peak rates* is approximately **0.63 m/h**, while the largest reference value, **Hay Point**, is about **1.23 m/h**; Mackay is about **1.15 m/h** and the Gold Coast Seaway about **0.33 m/h**. Extreme spring/king-tide changes, nonlinear estuarine amplification and meteorological effects are not fully represented by these averages; the Seaway can exceed the simplified model.

**Operational decision:** Raise the rate-only `NON_TIDAL_RAPID_RISE_M_PER_H` to **1.40 m/h** for every unverified-tidal gauge, above the largest modelled reference and approximately 2.2 times the representative reference mean. This removes normal 0.30–1.30 m/h rate-only blue markers, including the 0.50 m/h Seaway example when its tidal metadata/history have not yet been established. Known/source-tagged tidal gauges still have **no rate-only flash-flood screening** regardless of speed, because a fast tide or storm surge is not proof of flash flooding. Observed source-ID-linked tidal oscillation suppression is unchanged.

**Important sensitivity limitation:** This stricter blanket threshold can miss a real inland rapid rise between 0.30 and 1.40 m/h. That is a deliberate precaution against widespread tide-only false positives on a situational-awareness display. **It is not a BoM operational flash-flood threshold** and should not be treated as one. A later improvement should use reliable station-specific tide predictions, residual anomalies, coastal hydrodynamics and rainfall evidence instead of a global threshold. Until then, source-issued minor/moderate/major BoM flood categories stay displayed continuously and identically on map and gauge information panels, whatever the trend, while below-minor blue remains conditional on a verified recent rise.

**Shipping checks:** The current-production maintenance overlay copies the latest signal source, adds a new cache-bust suffix, verifies the 1.40 m/h constant, and writes an explicit release marker. The regression suite checks 2026 published representative port values, 0.30–1.30 m/h false positives, a strong 1.60 m/h unclassified rise, official source classifications, and explicit tide-tag suppression. This change must pass current frontend and Pages package tests and live public-site validation before being called deployed or sealed.

## Subsequent safety correction: inland 0.30 m/hour, coastal-uncertain 1.40 m/hour

**Why:** A single statewide high tide-derived rise threshold is unsafe for inland rivers. The 27 March 2025 Adavale flood required urgent rooftop rescues and helicopter evacuations after overnight flooding. Queensland IGEM found little warning for residents; ATSB documented rapidly rising water and disrupted communications. This evidence does NOT establish the hourly water-level rise at any particular BoM gauge, and no fictitious Adavale gauge/time series is introduced.

**Implementation:** `river-gauge-coastal-screen-v1.js` embeds 100 Queensland-region segments selected from public-domain **Natural Earth 1:110m ocean coastline**. It uses the gauge's original geo-referenced point (not its station name) and a deliberately wide *125 km coastline-distance buffer* to classify a gauge as `inland` versus `coastal-uncertain`; missing/outside-region coordinates are `unknown` and treated conservatively.

- Valid *inland* gauge farther than the buffer, with no source-tagged or source-observed tidal pattern: **0.30 m/hour** rapid rise screen, based on 2 fresh measured BoM observations 30–120 minutes apart and a current rising-tendency report.
- Within the geographically uncertain coastal screen (including Gulf) or coordinates absent: **1.40 m/hour** temporary conservative screen until better tidally corrected hydrological evidence is available.
- Where the source explicitly labels the gauge tidal OR the station's own time series demonstrates oscillatory tides: **no rate-only flash-flood arrow**; never suppress official BoM minor/moderate/major flood classification.
- Official BoM classifications and map/info-panel green/yellow/red states remain authoritative, regardless of trend, coast, or rise-screen threshold.

**Limitations:** The Natural Earth 1:110m outline is a generalized geographic reference, NOT a floodplain, tidal limit or hydrological catchment map. The 125 km buffer is a conservative filter, not a proven tidal reach. The threshold **is not an emergency warning trigger**. Some truly non-tidal sites within 125 km of the ocean may still miss a 0.30–1.39 m/hour rise, and some normally tidal sites beyond that buffer may show false rate-only indicators. Floodwaters can inundate towns without nearby BoM gauging; missing sensor feeds, short history, poor communications or rapid local rainfall are major independent gaps. The next scientifically preferable step is station-specific tidal predictions/residuals, upstream source-ID-linked water-level and rainfall evidence, and watershed topology.

**Adavale test fixture:** Use `[144.6005,-25.9108]` as the approximate *town* location in a SYNTHETIC feature, explicitly not claiming it is a specific BoM gauge or an observed 2025 history. Verify a .40 m/hour increase generates a candidate at that inland location, .29 does not; Gulf and Gold Coast .50 m/hour rises remain screened; all official flood-level colours stay persistent. Test exact-source-ID joins unchanged.

**Release:** CI must validate both the current 0.30 / 1.40 source constants and published shore reference file, run the entire frontend suite, then verify the public GitHub Pages copy of the *new* imported source. Do not seal a new version or call the update live until Pages public checks succeed.

## 2026-10-18 optional BoM recent-history 503 / missing CORS mitigation

Observed in browser: `/river-recent-history` occasionally returns HTTP 503 **without** `Access-Control-Allow-Origin` (reported at IDQ65392 station 539075). The repository Worker deliberately includes CORS on *all of its handled failures*, including transport failures and source 503, so a missing CORS header suggests an intermediary/Cloudflare-generated response, a not-yet-synced deployed Worker, or failure before the Worker handler completes. Logs alone cannot establish which. This patch reduces avoidable load and ensures read deadlines; it does not pretend to repair any external Cloudflare platform outage.

* Keep the Worker fetch deadline active until the station table body has actually streamed and been inspected; prior code cleared the deadline immediately after receiving HTTP headers. Bound expiry returns typed JSON 504 `source_timeout` with allowed-origin CORS.
* Skip **all optional history fetches for explicitly source-tagged tide gauges**, since these gauges can never generate a rate-only flash indicator. This does not disable persistence of any official flood classifications, or station-local browser observation history and tidal oscillation screening.
* Recover initial historical observations for **inland rising gauges below minor** where valid BoM recent links exist. This is necessary for the new Adavale-type 0.30 m/hour screening to be capable of identifying a first-session rise.
* Coastal-uncertain below-minor gauges without a history-derived rise do not trigger bulk source-page downloads; the conservative 1.40 m/hour rule and locally accumulated observations remain. Classified **minor, moderate and major** non-source-tagged river gauges still qualify for optional history if rising.
* Limit optional station downloads to **four serial requests per 15-minute bulletin cycle**, inland candidates first. A shared source-level transport failure still halts the burst and activates existing 15-minute backoff. Current BoM bulletin classifications always render without waiting for this history, and no Cesium rebuild occurs on history failures.
* Deploy the existing Cloudflare Worker in-place (no new worker) with its separate pipeline; probe known invalid-station and reported public valid-station endpoints after deployment with GitHub Actions, logging CORS status and source error code as warnings rather than turning temporary BoM source outages into radar-release failures.
* CI tests cover a stalled mid-stream body (504, CORS), upstream 503 with CORS, correct eligibility for inland below-minor versus source-tagged tides, and unchanged severe-class rendering.

**Remaining risk:** If Cloudflare itself produces a 503 before the Worker executes, no application-level code can attach CORS to that response. The probe exposes rather than conceals the condition. Without a successful optional station lookup or two suitably spaced fresh station observations in browser history, the blue rapid-rise screening is incomplete; no extrapolation is made. The base 15-minute BoM bulletin and persistent official classification remain independent.
