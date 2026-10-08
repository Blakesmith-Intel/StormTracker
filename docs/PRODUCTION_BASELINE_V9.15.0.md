# StormTracker — sealed production baseline V9.15.0

## Release lineage

| Version | Exact source commit | Restore branch |
| --- | --- | --- |
| V9.13.4 (previous known-good) | `84c941eabe9e12cb20b675873ae15e67d189c1ed` | `restore/v9.13.4` |
| V9.14.0 (source freshness) | `b799cb9b8cdda9f6cecc1945a148c2e574e8dd3e` | `restore/v9.14.0` |
| V9.15.0 (new production) | `363d336fff008a81f2f763ea3e5bd6d1dfdb5a16` | `restore/v9.15.0` |

**Release labels**: annotated Git tags `v9.14.0` and `v9.15.0`, created
by `.github/workflows/seal-v9-15-baselines.yml` only **after** successful
main Pages publication, source/regression checks, live production URL
verification and official relay comparison. The workflow confirms the
tag destinations before creating or accepting existing tags.

## Accepted operational configuration

- No local instance: browser-only application delivered by GitHub Pages,
  the existing free Cloudflare Worker relay, public BoM/QLDTraffic/
  other official provider feeds.
- V9.14 source freshness: operational datasets report loading failures
  rather than silently pretending the incident set is empty, old incident
  snapshots expire, and contextual interactive UI remains intact.
- V9.15 public QFD incidents: only QFD-published grouped Technical Rescue,
  Road Crash Rescue and Assist Public categories. Exact official source
  image symbols load on app startup even while the incident layer is
  switched OFF. Details panel with official source links user-confirmed.
- Storm tracks retain measured source 2-D reflectivity palette in tracked
  3-D displays; inferred vertical profile remains transparently inferred.
  Track-specific 3-D is always on when appropriate, with independent
  volume opacity (100% initial), radar opacity and Doppler opacity.
- Storm labels toggle immediately on the currently displayed frame
  without advancing or restarting a paused radar loop.
- **Unplanned road closures**: QLDTraffic records currently published
  and closed to **all traffic**, any unplanned hazard/cause; reject
  scheduled/planned roadworks/events, future/expired entries and partial
  closures. Map, legend and selected incident info use official public
  QLDTraffic all-traffic road closure symbols. Source links remain live.
  User visually confirmed Laidley Creek West Road display, symbols,
  and the top-left incident detail panel.
- The existing Worker `/flood-road-closures` endpoint keeps the original
  V9.13 legacy classification and cache; V9.15 uses isolated
  `/flood-road-closures-v9-15` with v6 cache, preserving rollback.
  A live reconciliation identified nine provider-eligible unplanned
  closures and exactly nine V9.15 results, including official event
  750590, at acceptance time; counts naturally change with provider data.
- Queensland-only outage policy, BoM flood signals, interactive source
  panels and geolocated labels retained. Radar and Doppler explicitly
  user accepted in V9.15 browser preview.

## Release QA evidence

- V9.14 authorised Pages deploy: [Actions run #37800870750](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37800870750)
- Accepted V9.15 authorised preview: [Actions run #37799551857](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37799551857)
- Official QLDTraffic relay deployment + exact live-source match: [Actions run #37799107199](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37799107199)
- Clean V9.15 release branch validated through PR #47 before merge.
- Final production publication, live smoke and tag creation are enforced
  by the sealing workflow and must succeed before declaring the tag sealed.

## Recovering or developing

- `main` is the operational baseline; prefer the tagged commit
  `v9.15.0` for reproducing the precise production code.
- To reverse a future regression, branch from
  `restore/v9.15.0` or the tag, test, and publish through a controlled
  PR. Earlier `restore/v9.14.0` and `restore/v9.13.4` are retained.
- Next wishlist features must start in a separate feature branch and
  must not alter the sealed tags/branches or add local hosting.
- A public source's incident count is time-varying. Never hard-code the
  acceptance-time count as a permanent expected incident total.
