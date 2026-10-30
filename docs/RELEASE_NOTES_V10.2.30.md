# StormTracker V10.2.30 — official BoM high-end hazard terms and compact VD cell labels (30 October 2026)

## Change from frozen V10.2.29
- Retains original warning-source geometry, stateful Locate, polygon-tap LDMG/DDMG report, cancellation, expiry, radar and existing operational layers unchanged.
- Recognises officially published warning words **damaging vs destructive wind**, **large vs giant hail**, **heavy vs intense rainfall**, and **tornado**, including exact AMOC spatial tokens `W/W+`, `LH/LH+`, `R/R+`, `TO`. Official reference: BoM Warning Products User Guide v2.8 (30 July 2026) and Spatial Data User Guide v2.3 (12 December 2025).
- `IDQ21033` is a **regional warning-area bulletin**. When source wording indicates destructive winds, giant hail, intense rainfall or tornadoes, a restrained **HIGH-END** qualifier appears in the active product status/report and original warning area outline has a slightly stronger border. No fake cell geometry, storm tracks or broad “VERY DANGEROUS CELL” label are generated.
- Detailed `IDQ21035` uses **IDQ65650** for threat area and the separate **IDQ65652** for original storm-location polygons. A specific original IDQ65652 cell explicitly identified in its own source text as very dangerous receives a **small red VD badge** when zoomed out and compact **VERY DANGEROUS** pill when zoomed in. The badge is placed inside the source footprint, without bulky leader arrows or white boxes.
- No new derived meteorological calculations, radar classification, paid service, cache or feed cadence. Original data validity and product distinction preserved.

## Operator interpretation
Damaging wind gusts ≥90 km/h, destructive ≥125 km/h; large hail ≥2 cm, giant hail ≥5 cm; heavy rain capable of flash flooding vs intense rain capable of dangerous/life-threatening flash flooding; tornado at any intensity is a high-end hazard. Terms describe official warned phenomena, **not observed measurements at every point**. Regional high-end wording does not certify any named individual cell as “very dangerous.”

## Verification boundary and seal
Regression tests cover source exactness, high-end wording/code combinations, no transfer of individual-cell status to regional areas, compact marker rendering at two zoom levels, and existing camera/interactive report. No genuine IDQ65652 storm-location feature was present in the accessible government mirror on 30 October; operational cell-specific danger-marker validation **remains pending the next real detailed issue**. Production must never simulate cells or dangerous designations.

When website and relay publish checks pass, seal NEW annotated `v10.2.30` / `restore/v10.2.30`, leaving all earlier immutable references including `v10.2.29` unchanged.
