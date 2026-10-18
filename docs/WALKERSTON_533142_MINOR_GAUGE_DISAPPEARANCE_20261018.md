# Root-cause incident: Bakers Creek at Walkerston gauge vanishes at minor (18 Oct 2026)

**Verified live BoM relay audit, 18 October 2026, 06:41 UTC / 16:41 AEST**:
- QLD National Flood Gauge Network metadata: 1,808 QLD point features; 1,144 recent reported river-height observations across all 12 river-height products; **one current source-classified minor-or-above station**.
- **Bakers Creek at Walkerston** (BoM river-height station **533142**, source **IDQ60290**), height **2.75 m** at **02.18PM Sun** (14:18 AEST), flood class **minor**.
- Exact national-network site is **Walkerston (Bakers Creek)**, BoM 533142, **information** (not qualitative) forecast-site classification, lat -21.1594, lon 149.0556. Not the distinct "Bakers Creek ALERT" BoM **533063** station. Both stations have distinct minor thresholds.
- BoM 2026 QLD SLS / flood-classification schedule: **Walkerston ALERT minor 1.4 m, moderate 3.2 m, major 4.8 m**; so the measured 2.75 m exceeds minor by **1.35 m**. These are *local station gauge datum heights*, not water depth across streets. No flood-warning bulletin was assumed or required.

## Exactly why it disappeared

The production `reconcileFloodEvents()` discarded any gauge whose observed time exceeded `FLOOD_SIGNAL_MAX_AGE_MS` (**90 minutes**); `evaluateFloodSignal()` repeated the exclusion. By 16:34 AEST the most recent BoM reading at 14:18 AEST was already **136 minutes old**, so the source-authenticated *minor* class was excluded during a normal or manual refresh. This was not a station-ID join failure (ID 533142 matched), no evidence of a measured fall below minor, not a tidal exclusion, and not the recent Doppler/WMTS change. The authoritative BoM *river heights* product has classifications independent of whether a warning is issued.

## Corrected narrow behaviour

- Once genuine BoM site ID 533142 (or any other source-confirmed minor/moderate/major site) is observed, keep the flood-colour map marker through an overdue or omitted observation. Refresh and page reload use only ID-keyed browser storage, with metadata and real observation attached; a station cannot be manufactured from a similarly named locality.
- Mark a non-fresh reading **LAST CONFIRMED, STALE** in the info panel, display its BoM observed time and note **current height unverified**. Report a stale-stage count in the layer status. Don't describe an old class as verified current.
- On a **new observation explicitly below minor**, remove the saved classified stage. If a later official class changes minor→moderate/major or vice versa, update that class and its observed time. Blank or missing observations are not evidence of recovery.
- A stale station may NOT carry a blue rapid-rise modifier. An unsupported below-minor rate-only indicator still expires if data is unavailable.
- This remains client-side: **no new polling, HTTP endpoints, database, render loop, paid service, or extra layer**. Uses the existing 15-minute BoM river-height refresh and one localStorage record per currently classified gauge.

## Testing and release

`frontend/tests/run-walkerston-last-confirmed-minor-persistence-20261018-tests.mjs` uses the **actual observed station ID, 2.75 m level, 14:18 AEST and 90-minute timeout condition** as a historical reproducible fixture. Also checks distinct Bakers Creek 533063 cannot be accidentally matched, missing/partial bulletins, 72-hour absence, recovered below-minor, stale modifiers removed. Full production regression/dry-run and published page verify the exact hotfix file and cache-bust chain. Preserve immutable V10.2.0 radar engine and Doppler/WMTS fixes.

**Safety limitation:** persistent **last-confirmed** status does not establish the height is still above minor during missing observations. Use the official current BoM reading, flood warnings and relevant authority advice for decisions.
