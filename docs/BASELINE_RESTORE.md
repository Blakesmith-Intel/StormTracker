# StormTracker V10.1.1 — production recovery and sealed rollback

**Accepted production source:** `711d65a72a483b319e80711a09cfeabe2f69bbcd` (17 October 2026).

- Public app: https://blakesmith-intel.github.io/StormTracker/
- Public source check: https://blakesmith-intel.github.io/StormTracker/BUILD.txt
- Exact marker: `SEALED StormTracker V10.1.1 source 711d65a72a483b319e80711a09cfeabe2f69bbcd`
- Immutable annotated tag: `v10.1.1`
- Immediate recovery branch: `restore/v10.1.1`

The Pages workflow first checks out and tests the **exact accepted source** into `checked/production-v10.1.1`, builds a deterministic root, verifies the public BUILD marker and source assets, and **only then** creates the tag and restore branch. Never repoint sealed tags/branches.

## Older retained recovery references

| Tag and restore branch | Exact source commit |
|---|---|
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
