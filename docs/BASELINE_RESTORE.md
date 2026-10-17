# StormTracker V10.0.0 — production rollback and recovery

**New production source:** `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`. Tag `v10.0.0` and branch `restore/v10.0.0` must dereference to that SHA after a successful Pages verification.

Production check: https://blakesmith-intel.github.io/StormTracker/BUILD.txt must equal `SEALED StormTracker V10.0.0 source e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`.

## Immutable historical releases

| Recovery reference | Commit |
|---|---|
| `v9.20.2` and `restore/v9.20.2` | `b8be458acbae942a3bb0b530a5c17618b6d03134` |
| `v9.20.1` and `restore/v9.20.1` | `efaceb59427f0b71859b15a61a6758a80d08547e` |
| `v9.20.0` and `restore/v9.20.0` | `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1` |
| `v9.19.0` and `restore/v9.19.0` | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` |
| `v9.18.0` and `restore/v9.18.0` | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` |

`/preview/radar-history-fix/` remains the pinned diagnostic at `acfa0ebd3717a793369e3e887e2d1a54785620b7`.

**Never force-push an old release reference.** To roll back, create a new reviewed production workflow cutover using the chosen existing exact SHA, run full regression and source audits, confirm the public marker, and issue a fresh rollback release if needed.

## Release validation
The release workflow tests the exact V10 source and relay, builds root only from `checked/production-v10.0.0`, verifies independent Doppler and original source-quality requirements, checks public assets and build marker, and only then creates the tag and restore branch. V9.20.2 stays recoverable throughout.

**Next:** authentic official BoM cyclone forecast positions/track and published uncertainty geometry; QA-only until source/time validation and operator review.
