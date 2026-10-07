# StormTracker production baseline — V9.8.3

The current full production baseline is sealed by the annotated Git tag `v9.8.3`.

V9.8.3 includes the complete Queensland radar-site expansion, source-aware radar
history windows, browser-local accumulation of genuine reflectivity frames toward
a three-hour history, bounded display-only temporal interpolation across short
missing intervals, the accepted 30-minute Doppler contract, persistent storm
tracking, inferred 3-D structure, mobile controls, and the selected-track motion
cone.

To restore without overwriting current work:

```bash
git fetch origin --tags
git switch -c restore/v9.8.3 v9.8.3
npm test
```

A repository restore branch named `restore/v9.8.3` also points to the exact
sealed production commit.

For future feature work:

```bash
git switch -c feature/next-work v9.8.3
```

Do not move or reuse the `v9.8.3` tag. Future production changes receive new
commits and a new version tag.

The production UI remains browser-only and live-weather focused. Radar history
older than the Bureau's current rolling WMTS window is accumulated locally in
IndexedDB while that radar view is used; it is not fabricated retrospectively.
Temporally inferred gap-fill frames are clearly labelled and excluded from storm
identity, Doppler analysis and scoring.

The previous `v9.7.2` baseline remains an immutable historical recovery point.
