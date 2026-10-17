# StormTracker V10.1.0 — 17 October 2026

**Immutable accepted source:** `11f0012170c4632bd5ef2448bf5671326fdd287e`
**Public marker:** `SEALED StormTracker V10.1.0 source 11f0012170c4632bd5ef2448bf5671326fdd287e`

## Promoted to production after operator acceptance

- Same simple operator UI and all previously sealed V10.0.0 capabilities.
- **Multi-site Doppler now uses the established multi-site rain radar prepare → stage → commit workflow.** The selected primary site is the playback clock; extra Doppler sources prepare for that UTC concurrently and all ready secondary images commit at the primary boundary. No more independently appearing patches during playback. A hard 350 ms optional preparation budget prevents slower BoM relays/sites from freezing the operator clock.
- Each source has its own **genuine BoM scan UTC**, chosen from its published history within ±8 minutes of the primary. The UI shows the signed offset; unavailable data is omitted, never filled synthetically. Each accepted scan preserves original native Doppler velocity colour data.
- Native Brewarrina **IDR93I** Doppler and 128 km site-centred display georeferencing added. Live BoM history and genuine 512 × 512 PNG retrieval through the **same existing production Cloudflare Worker** as Queensland verified in GitHub tests. Moree and Grafton correctly marked rain-only. Brewarrina source-image control-point registration remains pending; no unvalidated wind/circulation-science integration.
- Retained full-quality ≥40 dBZ inferred 3-D, BoM dBZ rain, 3 additional site ceiling, storm labels, primary +90-minute indicative motion cone, mapping/incident layers and performance safeguards.

## Release guarantees

Full source tests, browser contract tests for multi-site staged reveal, scene source clock and stale frame rejection, deterministic site-package QA, public Pages BUILD/source smoke checks, then immutably seal `v10.1.0` and `restore/v10.1.0`. The older `v10.0.0` (`e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`) remains available to roll back. No newly invented Workers or additional environments.
