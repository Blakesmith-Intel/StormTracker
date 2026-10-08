# StormTracker V9.13.0 — BoM Queensland flood signals

## User requirement

Display river-height gauges on the 3-D map **only** when one of the following holds:

1. **Tidal gauges**: a measured recent upward rate is anomalously fast compared with that station's own observed rising-tide pattern.
2. **Non-tidal gauges**: a verified rapid rise occurs while BoM reports a **minor** flood classification.
3. **Any gauge**: BoM's current, observed flood classification is **moderate or major**.

Never show every station, mere "rising" / "tidal rise", ordinary fluctuations, minor floods without verified rapid increase, or dated-out observations.

## Implementation

- Read Queensland-only BoM National Flood Gauge Network locations and current BoM river-height bulletins from existing Cloudflare Worker relay; no new hosting or paid services.
- BoM **moderate or major** classifications take precedence, including when the river is steady or falling, provided observations are dated and at most 90 minutes old.
- Non-tidal rapid rise: rise rate **>= 0.30 m/hour**, over **30–120 minutes**, current observation <=90 minutes old, actual BoM tendency "rising", and BoM flood class "minor".
- Unusual tide: compare the current **30–120 minute** observed rise with the **90th percentile** of historical observed rising limbs at the *same tidal station*. Require a positive baseline from at least **12 hours** of coverage, **8 historic readings and 6 rising intervals**, plus a current rate >=0.25 m/hour and >=1.75x historic P90. This is a **heuristic station-local tidal rise rate baseline**, **not predicted astronomical tide**, flood forecasting, a riverine flood warning or a confirmed storm surge. Display as **unusual tidal rise · screening**.
- Store timestamps in genuine **AEST** (UTC+10), reject future/invalid data, and never pair old bulletin readings with newer cached observations. Rate screens require at least two real independent observations.
- Normal tide, weak rise, unknown tendency, stale current reading, no history or otherwise unverified condition causes **no map marker**.
- Collect successive observations every **15 minutes while the page is visible**; store last four hours for non-tidal gauges and last 48 hours for tidal gauges to fit mobile browser storage. Browser history is opportunistic: closed/suspended tabs cannot be treated as always-on monitors.
- Add clickable detail fields describing source, classification, rise rate, observation interval, tidal-history baseline and the **screening-only** nature of algorithmically flagged events.
- Toggle is enabled by default; normal background datasets (radar, Doppler, road closures, outages, satellite imagery and State border) remain untouched. Hiding flood markers does not stop sampling while the browser is visible.

## Operational interpretation and limitations

- Threshold values are **conservative initial screening defaults**, not BoM official flash-flood thresholds. River response varies by catchment and gauge; a rising gauge cannot alone confirm flash flooding.
- Comparing 48-hour station history to a tidal rise is a provisional proxy only; it **does not distinguish astronomical tide, freshwater inflow and storm surge with scientific certainty**. Adding published tide predictions or independently validated station-specific normal tidal responses would improve discrimination.
- Rate-based alerts will need a warm-up period when the user first opens the application, and may be absent when browser storage is cleared. Do **not** infer no flood risk from an empty overlay.
- BoM's official Flood Warnings and local emergency advice take precedence over this situational-awareness screen.

## Verification

- Unit cases cover stale/future/invalid AEST readings, no guessing from tendency, major/moderate precedence, below-minor exclusion, rapid rises above minor, tidal normal-vs-anomaly, short/long history and storage size.
- Integration fixture simulates two BoM bulletin snapshots and verifies that only a moderate flood and then a rapidly rising minor flood become markers, while normal tidal motion is suppressed.
- Live BoM relay smoke (8 October 2026): 1,808 Queensland gauge metadata locations, 1,143 current bulletin observations, 1,111 matches and 100% AEST timestamp compatibility for sampled observations.
- Full frontend regressions and mobile browser integration must pass before merging to main.
- Rollback production baseline: `v9.12.5` commit `266e47c6d2ad2f64510d54bd04f87ad63467a3c0`, restore branch `restore/v9.12.5`.
