# V10 retrospective replay — Gympie 08, 24 November 2025

**Status:** completed controlled historical comparison (research only), not operational warning validation.

**Reproducible workflow:** [GitHub Actions #37979455916](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37979455916), **conclusion: success**, source commit `66bdb69a422c681602b04a331b63304c1b85970d`.

## Source and methodology

- Original real AURA Level-1 Gympie radar-08 polar scans, 24 Nov 2025, 05:00–10:30 UTC (15:00–20:30 AEST).
- **28** real scan timestamps, **512 × 512** spatially regridded 2-D reflectivity. No synthetic scans or time interpolation.
- Reuse of the exact historical segmentation and tracking path from the previous hook replay.
- Existing V9 experimental hook module used as control; new V10 classifier independently applied to the same observed frames.
- Actual co-elevation (lowest 0.5°) AURA velocity gates spatially nearest-sampled into the same grid. Research sampling uses every second grid pixel, measured reflectivity QC >=40 dBZ, nonzero velocity, and excludes uncorrected raw radial magnitudes >70 km/h to match the public display scale's bounded range. This sampling is **not equivalent to a fully validated public BoM image decoder**.
- No velocity dealiasing, motion subtraction, multi-elevation circulation fitting, low-level vertical extrapolation, or ground-truth tornado/peak gust checks.

## Headline results

| Metric | Observed replay result |
| --- | ---: |
| Valid real scan timestamps processed | 28 |
| Previous experimental two-scan hook flags | 2 |
| V10 persistent hook-shape-only candidates | 2 |
| V10 combined hook + colocated Doppler tornadic candidates | 0 |
| V10 strong same-sign radar radial wind candidates | 0 |
| Verified 90 km/h damaging surface gusts | Not assessed — no station feed |
| Verified 125 km/h destructive surface gusts | Not assessed — no station feed |

### ST0027 — confirmed algorithmic consistency
| Observed UTC | AEST | Candidate | Approximate hook arc | V10 escalation |
| --- | --- | --- | --- | --- |
| 2025-11-24 06:00 | 16:00 | ST0027 | 105° | hook-shape-only |
| 2025-11-24 06:05 | 16:05 | ST0027 | 120° | hook-shape-only |

Control V9 flagged precisely these same two frames, and V10 reproduced them. The additional radial evidence rules did **not** escalate either detection to tornadic status.

**Interpretation:** This is an encouraging *consistency and specificity check*, not a validation of tornado detection sensitivity or operational severe wind prediction. In particular, **zero V10 Doppler alarms does not prove there were no destructive winds**. The QC excludes potentially folded/uncertain raw velocities, the single lowest elevation is not the ground, scan coverage may miss events, and many genuine tornadoes lack a classic hook echo or resolvable couplet.

## Practical follow-up for V10 acceptance

1. Review the native HDF5 Doppler gates and multiple elevations around ST0027 in the previously created AURA research audits; check beam height, velocity aliasing and proximity to the visual hook.
2. Compare against independent verified Australian tornado, downburst and gust observations, including negative-control thunderstorms, to measure false positives and missed events.
3. Re-run sensitivity tests for 60 km/h high radial, 40 km/h opposite-sign couplet, 3/5/8/10 km spatial windows and the two-scan persistence rule. Do not tune on a single case and call it validated.
4. Connect actual BoM station observations before implementing real 90/125 km/h threshold alerts. A Doppler reading does not classify a surface gust.
5. Keep all live V10 outputs marked experimental until physically validated and visually reviewed.

The original JSON results for all 28 scans are archived as the **Gympie-2025-V10-severe-signature-QC** artifact attached to [the successful workflow](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37979455916), which has a limited GitHub retention lifetime.
