# StormTracker — current recovery and release procedure

As of 13 October 2026, the **user-accepted working diagnostic source** is `acfa0ebd3717a793369e3e887e2d1a54785620b7`, preserved at `restore/v9.18-accepted-diagnostic-20261013`.

The **sealed production source** is `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` (V9.18.0). Do not move this reference or promote the diagnostic build without explicit user authorisation.

The entire repository state immediately before administration cleanup is preserved at `archive/pre-cleanup-20261013` (commit `3633307ec502ad85359a2e4e7d41cbcac22005c4`).

## Recovery

1. Use `git fetch origin` and inspect the source commit, not a similarly named old branch.
2. For **accepted QA** restore a new branch at `acfa0ebd3717a793369e3e887e2d1a54785620b7`; leave the original recovery branch intact.
3. For **sealed production** use a new branch at `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` and run the full release regression suite.
4. To restore old installer/deployment experiments, inspect `archive/pre-cleanup-20261013` or individual historical commits. Do not restore the entire old multi-preview Pages workflow to `main`.
5. Verify the public `/BUILD.txt` and `/preview/radar-history-fix/BUILD.txt` match their pinned commits after a deployment.
6. Run `npm test` and `node --check relay/worker.js` before promoting a build; perform desktop/mobile visual acceptance.

## No surprises

`main` is not the deployed production release. The Pages workflow deliberately builds the root from the pinned sealed production source and a *separate* preview from the accepted diagnostic source. Production and the recovery ref must remain immutable.
