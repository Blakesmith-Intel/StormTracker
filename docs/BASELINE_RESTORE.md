# StormTracker V10.2.0 — cyclone UI release and sealed rollback

**Verified sealed release source:** `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2` (17 October 2026), immutable annotated `v10.2.0` and `restore/v10.2.0` verified after deployment.

**Previous sealed V10.1.1 source:** `711d65a72a483b319e80711a09cfeabe2f69bbcd` — preserved as the immediate fallback.

- Public app: https://blakesmith-intel.github.io/StormTracker/
- Public source check: https://blakesmith-intel.github.io/StormTracker/BUILD.txt
- Exact marker: `SEALED StormTracker V10.2.0 source 047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`
- Immutable annotated tag: `v10.2.0`
- Immediate recovery branch: `restore/v10.2.0`

The Pages workflow checks out and tests the **exact source** into `checked/production-v10.2.0`, builds a deterministic root, verifies the public BUILD marker and source assets, and **only then** creates the tag and restore branch. Never repoint sealed tags/branches.

## Older retained recovery references

| Tag and restore branch | Exact source commit |
|---|---|
| `v10.1.1` / `restore/v10.1.1` | `711d65a72a483b319e80711a09cfeabe2f69bbcd` |
| `v10.1.0` / `restore/v10.1.0` | `11f0012170c4632bd5ef2448bf5671326fdd287e` |
| `v10.0.0` / `restore/v10.0.0` | `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5` |
| `v9.20.2` / `restore/v9.20.2` | `b8be458acbae942a3bb0b530a5c17618b6d03134` |
| `v9.20.1` / `restore/v9.20.1` | `efaceb59427f0b71859b15a61a6758a80d08547e` |
| `v9.20.0` / `restore/v9.20.0` | `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1` |
| `v9.19.0` / `restore/v9.19.0` | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` |
| `v9.18.0` / `restore/v9.18.0` | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` |

The V9.18.0 `/preview/radar-history-fix/` diagnostic stays pinned at `acfa0ebd3717a793369e3e887e2d1a54785620b7`.

**Rollback:** create a reviewed new release by changing the pin to the selected existing recoverable SHA, run the full validations, verify the public site, and create a **new** release reference. Do not force-push or repoint prior tags.

**V10.1.1 science:** primary UTC controls native Doppler, secondary genuine BoM scans ≤8 minutes offset; optional staged site images commit as one synchronous handover. Source time and BoM imagery remain genuine; no secondary wind drives circulation science until its geometry is validated.

**V10.1.1 UI-specific correction:** The source-pinned CSS fixes a specificity conflict between collapsed map and simple UI layout. A cache version bump updates the iframe and stylesheet; source/tests guarantee collapse fills desktop and mobile. The Doppler synchronisation and original source/3-D rendering are unchanged from V10.1.0.

**Cyclone source boundary:** Forecast panel and authentic GML import are enabled, source off until operator toggles. BoM's 'Currently no tropical cyclone warnings' is displayed only after a verified empty current-product feed; network failure must never appear as an all-clear. Live FTP-to-browser bridge and automatic `IDQ20023` bulletin pairing are not delivered in this version.


**Tag/recovery reference repair verified:** [GitHub Actions run 39012793972](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39012793972) completed both separate Pages deployment and release-sealing jobs. The Git Data REST tag object `c7d4c95a20d2d124a5f53b5a3151dd0cad6a9598` is an **annotated tag** peeling to exact commit `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`. The restore branch matches; V10.1.1 refs were checked unchanged. Sealing can be retried without rerunning Pages. The source-pinned V10.2.0 application was not modified by this workflow hotfix.
