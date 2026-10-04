# StormTracker final baseline — V9.7.2

The final production baseline is sealed by the annotated Git tag `v9.7.2`.
The finaliser prints and records the exact commit SHA after it commits and pushes.

To restore without overwriting current work:

```bash
git fetch origin --tags
git switch -c restore/v9.7.2 v9.7.2
npm test
```

For future feature work:

```bash
git switch -c feature/next-work v9.7.2
```

Do not move or reuse the `v9.7.2` tag. Future changes receive new commits/tags.

The production UI is live-weather only. Christmas 2023 scenario/regression modules
remain internal engineering tests and continue to run under `npm test`; the public
historical-validation page/controller are deliberately removed.

Reset view remains because it is functional. Cesium/OpenStreetMap attribution is
required and is deliberately rendered in a static credit container outside the
weather-frame crossfade.

Scientific boundaries are unchanged: only the recovered 08/50/66 registrations
feed exact storm-footprint wind analysis; the 11 added Doppler panels remain
nominally registered display overlays. Inferred vertical structure and ordinal
convective/lightning assessment remain explicitly inferred.
