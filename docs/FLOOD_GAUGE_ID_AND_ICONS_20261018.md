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
