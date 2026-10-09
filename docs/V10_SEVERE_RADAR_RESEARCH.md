# StormTracker V10 — severe radar signatures (experimental, opt-in)

**Status:** V10 research branch only. Not production and not scientifically validated for operational warning generation. Based on pinned main V9.16.14 at `0c7424abdc659e5874595473c0e91953ffa0a48b`.

## Purpose
Expose research-quality *candidates* from original BoM measured 2-D reflectivity and independently decoded BoM radial velocity in the existing in-browser map alert dock. Preserve native BoM imagery, smooth playback, ST storm tracks, source timestamps, browser-only architecture, all QLD radar sites, and live production baseline.

## Official BoM definitions and correct data semantics
- **Damaging gust:** a measured/forecast thunderstorm wind gust **at least 90 km/h**.
- **Destructive gust:** a measured/forecast thunderstorm wind gust **at least 125 km/h**.
- An observed BoM AWS station's reported **3-second maximum wind gust** may be classified using these exact thresholds, when verified as recent and attributed to the reporting station.
- **Radial Doppler speeds are not surface gusts, horizontal wind vectors, storm translation speeds, or proof of tornadoes.** The available public image decoder uses approximately **-70 to +70 km/h** displayed palette. It cannot establish either BoM 90 or 125 km/h gust classification.
- BoM severe thunderstorm warnings are issued by BoM meteorologists and supersede this experimental detector. A station exceeding 90/125 km/h does not necessarily prove its gust was from a thunderstorm.

Primary definitions: https://www.bom.gov.au/resources/learn-and-explore/severe-weather-knowledge-centre/thunderstorms
Station source-format example: https://www.bom.gov.au/products/IDQ60801/IDQ60801.94576.shtml

## Experimental candidate output
| Category | Evidence required | What it does NOT claim |
| --- | --- | --- |
| Hook shape only | A connected lower-reflectivity arc around an existing ≥40 dBZ tracked core in two consecutive actual observed frames within 15 min | Not radar-confirmed rotation or a tornado |
| Tornadic signature candidate | Hook criteria **plus** nearby opposite-sign same-radar radial velocity clusters (at least two toward and two away, speeds at least 40 km/h, close spatial pairing), with both sides within 10 km of hook | Not a tornado warning, not validated tornado probability |
| Strong straight-line wind signature candidate | At least three local same-sign radial velocity pixels of magnitude ≥60 km/h within 5 km, no local opposite-sign cluster ≥40 km/h within 8 km | Not a 90/125 km/h gust, not verified downburst or horizontal surface wind |
| BoM station damaging/destructive **observation classifier** | BoM-AWS source, geolocated station, actual wind gust reading, no older than 15 minutes; ≥90 / ≥125 km/h | This is **library logic only**, not currently connected to a live Queensland-wide AWS feed |

Wind signature labels report the actual measured **radial velocity**. Tests rejecting out-of-range palette values, nonverified radar geometry, unpaired timestamps, and inferred radar frames are mandatory.

## Guardrails
- Only radars 08 (Gympie), 50 (Marburg) and 66 (Mt Stapylton) are admitted to V10 calibrated radial analysis.
- Never run the detector over inferred 3-D volumes, display-only motion interpolation, synthetic frames, time-shifted winds, or Doppler image overlay composites. The independent Doppler record is checked against measured radar source UTC, within eight minutes.
- During V9's native Doppler-only playback there is **no corresponding displayed measured reflectivity track frame**; full hook+wind combined analysis is therefore unavailable. No false pairing.
- Candidates are **experimental** and user-opt-in (default off). The original hidden V9 research toggles remain disabled.
- Alerts appear as clickable map pins and a dock inside the browser, with source clock, observation state (latest / historical / stale), and direct official BoM radar link. They do not issue desktop OS notifications or official alerts.
- Historical replay must not be represented as a new active threat. Alert display always communicates original observations.
- Candidate locations and apparent rotation are approximate: dealiasing, beam geometry, elevation, attenuation, sampling density, palette limits and radar data gaps can create false positives or missed severe events.
- No additional per-frame network requests for active V10 radar detection: it reuses the already-decoded BoM source record. All processing is browser-side; existing Cloudflare Workers only relay public-source content.

## Verification and release gate
1. Run `npm test` (including `frontend/tests/run-severe-storm-v10-tests.mjs`).
2. Validate original-source replay against multiple known tornadic, nontornadic, microburst/derecho and clutter cases, including ambiguous signatures and missing scans.
3. Check live source clock alignment, browser performance, mobile map controls, false-alert rate and alert clarity.
4. Connect an approved public BoM AWS observation feed before enabling real **damaging** or **destructive gust** alerts; identify station-specific measurements, ensure provenance and show observation age.
5. Consider official BoM warning feed context in the UI before any production release.
6. Obtain explicit visual acceptance before promoting V10. Do not overwrite/retag the sealed V9.16.14 production release.

## Rollback
Switch off **V10 storm signatures (experimental)** in the layer controls. All V9 product logic and official source presentation remain intact. The feature branch can be discarded without changing the production branch or deployed Pages root.
