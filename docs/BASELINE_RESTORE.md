# StormTracker production baseline — V9.9.0

V9.9.0 is the current accepted full production baseline and completes wishlist
item 1: switchable GA satellite context, place-name reference overlay and optional
3-D terrain.

## Authoritative runtime

Accepted runtime commit:

```text
de724bdeb1d92d4dd4cb2e7f99492f548dd418f4
```

That build passed the complete frontend validation gate and was deployed through
the normal GitHub Pages workflow on 8 October 2026 (AEST).

The complete sealed repository recovery reference is:

```text
restore/v9.9.0
```

That branch includes the accepted runtime plus the final V9.9.0 README, release
record, restore notes and future-development handover.

## Restore without overwriting current work

```bash
git fetch origin
git switch -c recovery/v9.9.0 origin/restore/v9.9.0
npm test
```

For future feature work:

```bash
git fetch origin
git switch -c feature/next-work origin/restore/v9.9.0
npm test
```

Do not move or reuse `restore/v9.9.0`. Future accepted production changes should
receive a new recovery reference.

## Production contract preserved at this baseline

- Browser-native static product; no localhost or user-managed runtime is required.
- All 19 public Queensland radar sites remain selectable.
- Five-minute automatic source checks remain the live cadence.
- Radar-only loops advance on the newest reflectivity independently of Doppler
  unless the Doppler overlay is explicitly enabled.
- Measured 2-D reflectivity controls storm identity and horizontal motion.
- Live vertical structure remains inferred.
- Doppler remains radial velocity; calibrated analytical use remains restricted
  to 08/50/66.
- Radar-only history can accumulate to a rolling three hours per viewed radar via
  browser IndexedDB, with roughly four hours retained as a storage buffer.
- Source-aware loop choices never claim unsupported fixed windows.
- Bounded temporal interpolation may fill missing display slots only between real
  observations and only for gaps of 30 minutes or less.
- Temporally inferred frames remain display-only and are excluded from tracking,
  Doppler analysis and scoring.
- Automatic cache/history backfill triggers a chronological tracking rebuild so
  the displayed loop expands without a manual refresh.
- Doppler remains constrained to genuine shared 30-minute history when enabled.
- Playback slider bounds follow the complete dynamically loaded frame history.
- Street/OpenStreetMap and GA satellite basemaps are switchable without resetting
  radar, camera, tracking or playback state.
- GA satellite mode uses Geoscience Australia's cached Landsat-derived imagery and
  a transparent place-name/boundary reference overlay.
- Optional 3-D terrain uses ArcGIS WorldElevation3D/Terrain3D and falls back to the
  ellipsoid if unavailable.
- Active camera movement temporarily relaxes terrain mesh detail and restores full
  detail after the gesture settles; touch and wheel camera updates are batched to
  avoid redundant renders.
- Track selection, labels, mobile controls and the +90-minute motion cone remain
  protected baseline behaviour.

Historical recovery references, including `restore/v9.8.4`, remain unchanged.
