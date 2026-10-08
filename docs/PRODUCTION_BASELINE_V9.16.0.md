# StormTracker V9.16.0 — Production playback acceptance

Visually accepted: 9 October 2026 (AEST). Source preview: `feature/severe-storm-radar-alerts-v1` at `f377a930e661a7b3b6dc04864acf131905cc4d27`.

## Approved window and playback contract
- Browser-only deployment on GitHub Pages; existing Cloudflare public relay, no local hosting.
- Exactly four windows, in order: **Radar + Doppler — All available**; **60 min — Rain radar only**; **120 min — Rain radar only**; **180 min — Rain radar only**.
- Combined loop remains bounded by genuine available Doppler observations, with all original wind source frames, radar scans displayed against the source-native timeline, and separate real AEST / UTC source timestamps. No fabricated coincident source times.
- New genuine Doppler frames trigger a combined-loop refresh through the existing 5-minute data polling cycle.
- A single Play/Pause bar. No separate Doppler toggle; opacity sliders control visual presence of rain, Doppler and inferred 3-D volume.
- Rain-only modes never show lingering wind frames or artificially extend Doppler over the longer radar loop. Temporarily unavailable fixed rain-only history does not switch the user's selection to combined.
- Preserve >=40 dBZ inferred-volume visibility limit, synchronous tracked point/label controls, interactive Queensland layers, and source links.

## Safety and scientific gate
- Severe wind/hook research from the candidate is **not** approved for operational use by the playback visual acceptance.
- Production hides and disables both alert controls, disables its overlay, and explicitly prevents research alert calculations in `syncSevereStormAlerts`.
- The original experimental work, Gympie 2025 archived evidence and research controls remain available only in isolated `/preview/v9.16/`, including within draft pull request #54. Do not portray a decoded Doppler display channel capped near ±70 km/h as validated >=90 km/h wind information or surface gust.
- No operational tornado/hook-shape prediction is released.

## Release governance
- Full frontend suite + live Pages verification must succeed before `v9.16.0` seal.
- Preserve immutable recovery branch `restore/v9.16.0` and previous `v9.15.1` / `restore/v9.15.1`.
