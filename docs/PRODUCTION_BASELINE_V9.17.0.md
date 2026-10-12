# StormTracker V9.17.0 — authoritative production baseline and restore

**Accepted baseline:** V9.17.0, 13 October 2026 AEST (pending verified release workflow while promoted).  
**User acceptance:** dBZ-only BoM 2-D/3-D palette, rounded/relative-height volumes, 1.0× default, 22 radar choices and minimal mobile radar-dish icons.  
**Live:** https://blakesmith-intel.github.io/StormTracker/  
**Version tag:** `v9.17.0`  
**Immutable restore branch:** `restore/v9.17.0`  
**Fallback:** `v9.16.15` / `ec3508dc7c2e263b1f3fcfc16803bc5bc7e469f5`

Pages is intentionally not a live build of whatever is on `main`. The **exact source SHA** is displayed in public `/BUILD.txt`, and the Pages workflow validates the deployed source and tag reference. The public `/preview/volume-dbz/` remains available for comparison; future development must branch from `restore/v9.17.0` once sealed.

## Recovery / reproduction

```sh
git fetch origin --tags
git switch -c recovery/v9.17.0 origin/restore/v9.17.0
npm test
node --check relay/worker.js
```

A code checkout alone does not switch live Pages production. To restore V9.16.15 on Pages, revise the workflow production `ref` and related BUILD/smoke references to the **original immutable** V9.16.15 SHA, not a moving branch; run GitHub Pages deployment, then check public root and original DoPpler/tracking/labels. Do not delete/move historic tags or restore branches.

## Protected release attributes

- BoM dBZ source and colour classes uniformly displayed in 2-D and inferred 3-D.
- ≥40 dBZ display floor, ≥16 measured connected-pixel segmentation, no artificial area rule.
- Track-internal column-specific observed dBZ drives a display-only 1.0–1.4× height multiplier, combined with 1.0× default manual exaggeration; NOT observed echo-top height.
- Original measured footprint retained below inferred volume; track ID and labels remain independent.
- 19 Queensland + 3 NSW radar windows; one primary + up to three extras.
- 18px borderless vector station icon with accessible name, click/tap to primary, independent place-name overlay.
- Brewarrina wind source `IDR93I` is source-whitelisted but **runtime disabled** until isolated Worker and spatial validation; no incidental changes to current production Cloudflare Worker.
- Browser-only operation, original BoM timing and all existing situational-awareness overlays preserved.

Use [the release notes](CHANGELOG_V9.17.0.md), [user guide](USER_GUIDE_V9.17.0.md), [engineering handover](HANDOVER_V9.17.0.md) and [scientific contract](SCIENTIFIC_CONTRACT.md) before any next release.
