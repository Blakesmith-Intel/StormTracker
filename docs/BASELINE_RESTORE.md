# StormTracker production baseline — V9.8.4

V9.8.4 is the current accepted full production baseline.

## Authoritative runtime

Accepted runtime commit:

```text
acbc6aa63829d0532e32c28c2b0a49030a29b276
```

That build passed the GitHub Pages validation/deployment gate on 7 October 2026.

The complete sealed repository recovery reference is:

```text
restore/v9.8.4
```

That branch includes the accepted runtime plus the final V9.8.4 README, release
record and handover documentation.

## Restore without overwriting current work

```bash
git fetch origin
git switch -c recovery/v9.8.4 origin/restore/v9.8.4
npm test
```

For future feature work:

```bash
git fetch origin
git switch -c feature/next-work origin/restore/v9.8.4
npm test
```

Do not move or reuse `restore/v9.8.4`. Future accepted production changes should
receive a new recovery reference.

## Production contract preserved at this baseline

- Browser-native static product; no localhost or user-managed runtime is required.
- All 19 public Queensland radar sites remain selectable.
- Five-minute automatic source checks remain the live cadence.
- Measured 2-D reflectivity controls storm identity and horizontal motion.
- Live vertical structure remains inferred.
- Doppler remains radial velocity; calibrated analytical use remains restricted
  to 08/50/66.
- Radar-only history can accumulate to a rolling three hours per viewed radar via
  browser IndexedDB.
- The displayed three-hour window rolls forward as new observations arrive; the
  browser cache retains roughly four hours before pruning.
- Source-aware loop choices never claim unsupported fixed windows.
- Bounded temporal interpolation may fill missing display slots only between real
  observations and only for gaps of 30 minutes or less.
- Temporally inferred frames remain display-only and are excluded from tracking,
  Doppler analysis and scoring.
- Automatic cache/history backfill triggers a chronological tracking rebuild so
  the displayed loop expands without a manual refresh.
- Doppler remains constrained to genuine shared 30-minute history.
- Track selection, labels, mobile controls and the +90-minute motion cone remain
  protected baseline behaviour.

Historical references such as `restore/v9.8.3` and the earlier `v9.8.1` tag
remain unchanged.
