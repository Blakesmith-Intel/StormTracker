# Recovered structure of the lost StormTracker repository

The exact repository tree is no longer available, but the retained development handoffs establish the following major paths with high confidence.

```text
StormTracker/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── main.py
│   │   │   ├── storm_tracks.py
│   │   │   └── lightning.py
│   │   ├── radar/
│   │   │   ├── live_storm_cells.py
│   │   │   ├── live_storm_tracking.py
│   │   │   ├── realtime_volume.py
│   │   │   └── live_volume_source.py
│   │   └── lightning/
│   │       ├── __init__.py
│   │       └── likelihood.py
│   └── tests/
│       ├── test_api.py
│       ├── test_live_storm_cells.py
│       ├── test_live_storm_tracking.py
│       ├── test_lightning_likelihood.py
│       └── test_realtime_volume.py
├── config/
│   ├── public_source_policy.json
│   └── realtime_volume_requirements.json
├── scripts/
│   ├── audit_public_live_inputs.py
│   ├── segment_live_storm_cells.py
│   ├── build_live_storm_tracks.py
│   ├── build_public_lightning_likelihood.py
│   ├── validate_aura_3d_pipeline.py
│   ├── probe_live_volume_sources.py
│   └── inspect_realtime_radar_sample.py
├── frontend/
│   ├── georef.html
│   ├── 3d-analysis.html
│   ├── 3d-tracks-addon.js
│   ├── live-lightning.html
│   └── 3d-data/
│       └── sequence/
│           ├── manifest.json
│           └── *.bin
├── data/
│   ├── radar/
│   │   ├── raw/ or source frame storage
│   │   ├── processed/
│   │   │   ├── 08/
│   │   │   ├── 50/
│   │   │   └── 66/
│   │   └── derived/
│   │       ├── live_tracking/live_tracks.json
│   │       └── lightning/public_lightning_likelihood.json
│   └── aura/
│       └── derived/66/2014-11-27/...
└── README.md
```

Additional files existed during development, including BOM radar map/geometry files, processed Web Mercator PNG/GeoTIFF products and metadata sidecars.

## Why the reconstructed production tree is different

The Python `backend/` existed because the original project downloaded, georeferenced and processed radar imagery before serving results through FastAPI. That design conflicts with the subsequently adopted requirement that StormTracker run in a browser without a locally/server-installed modelling engine.

The new `frontend/src/` modules directly implement the validated algorithms. `reference/python/` retains the recovered behaviour for audit/parity purposes without making Python a production dependency.
