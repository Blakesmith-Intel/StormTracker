# StormTracker V10.2.25 — opt-in official BoM severe-warning polygons

**Operator-approved production release, successfully deployed and sealed:** 27 October 2026 (AEST).  
**Base:** retain frozen V10.2.0 radar/science source and every accepted V10.2.24 maintenance overlay unchanged.  
**Verified release:** Annotated `v10.2.25` and `restore/v10.2.25` both peel/resolve to exact release commit `d9620f6cbc411bfee029d9fa9d170752aa7c34f2`; the [Pages deployment](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/40513984885) and [existing Cloudflare relay deployment](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/40513984589) both completed successfully. Do not repoint this tag or older releases. Later V10.2.26 contains documentation-only completion; it is not a change to this accepted feature.  
**Operator guide:** [OPERATOR_GUIDE_CURRENT.md](OPERATOR_GUIDE_CURRENT.md).

## Delivered as a new opt-in layer

- **BoM severe warnings** in the existing Layers panel, initially off. Original source CAP geographic polygons are drawn as lightweight terrain imagery **beneath the existing measured radar layer**. Existing map performance, incident overlays and the radar/3-D foundation are unchanged.
- Filter **All / IDQ21035 (detailed Southeast Queensland) / IDQ21033 (regional Queensland)**. Keep the original product code explicit, never classify a warning by drawn-area size. Applicable Queensland severe-weather products are also accepted in the All option.
- Clicking an active polygon displays source headline, warning text, hazard advice, product ID, issue/expiry times and link to the original BoM warning.
- **Affected LDMG / DDMG report:** list all intersecting Queensland local-government areas (the basis of LDMGs), and actual Queensland disaster-management districts. Official LGA and disaster district geometries are queried with `esriSpatialRelIntersects`; **no minimum percentage or polygon-overlap area**. Do not infer LDMGs/DDMGs from the warning's prose or a representative point. Report incompleteness clearly when boundary services fail.
- Automatic source checks **every 15 minutes while enabled**; manual refresh bypasses that schedule. On a successfully retrieved BoM CAP cancellation, remove that product's polygon; on a newer valid issue, replace its old geometry without a duplicate. No obsolete polygon remains after expiry.
- **No-warning is not a source error:** on a complete source check with no active product, display zero polygons. Distinguish this from incomplete source checks, network timeouts, and a genuine BoM product with missing geospatial polygons. Missing data must not be presented as an all-clear.
- Conservative **NSW withholding** until exact union-of-radar-coverage clipping is complete.

## Live-source limitation and acceptance

The publicly accessible WMO-listed BoM CAP feed returned valid CAP documents at the time of the release review but **no currently verifiable active original severe-warning polygons** for the tested products. Therefore the actual polygons' **live appearance and corresponding official LGA/DDMG list cannot be operationally validated until BoM next publishes them**. This is not evidence that no BoM warnings exist beyond the checked source. Never create synthetic live warnings, extrapolate polygon geometry from bulletin names, or substitute an unrelated local emergency alert.

The feature is released as **opt-in, source-status-aware functionality**, not a promise of continuous access to genuine BoM GIS geometry. The layer must display unavailable whenever it cannot confirm a live source. For operational decisions consult the original BoM bulletin. A subsequent genuine issued product is the first end-to-end live geometry acceptance opportunity.

## Recovery

Previous `v10.2.24` tag / restore branch remain sealed; new `v10.2.25` references target only the new accepted source commit. The Cloudflare relay Worker is separately deployed and must be verified independently in case of rollback; old external observations cannot be frozen.
