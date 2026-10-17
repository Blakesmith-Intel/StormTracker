# Brewarrina Doppler transport live-recovery (17 October 2026)

The 17 Oct GitHub-hosted probe of exact configured endpoints proved this is an infrastructure break, **not** an inaccurate source catalogue:

- `https://stormtracker-bom-relay-nsw-preview.stormtracker-bom-relay.workers.dev/radar-history?product=IDR93I` → **HTTP 404**.
- Same NSW preview `/radar?product=IDR93I` → **HTTP 404**.
- Deployed original Queensland worker `/radar-history?product=IDR93I` → **HTTP 403**, `Doppler product not allowed` (its deployed revision predates the 93 allowlist).
- Direct BoM `IDR93I.loop.shtml` and `/radar/IDR93I.gif` from GitHub's runner → **HTTP 403 / Access Denied**. This does not establish whether Cloudflare's worker can read the same public pages; the worker must be tested independently.

GitHub `.github/workflows/deploy-nsw-doppler-preview.yml` now has a **scoped deployment** for the existing `relay/wrangler-nsw-preview.jsonc` Worker, triggered by relevant source changes on `main`. It runs source-validation tests and then deploys only `stormtracker-bom-relay-nsw-preview`; does **not** redeploy or change the accepted Queensland worker or immutable V10.0.0 production. GitHub Actions requires both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets as specified by the existing manual relay workflow.

Run results must explicitly show HTTP status of the NSW Worker. A successful deployment or source response is **not** proof of pixel/georegistration accuracy, which still requires authentic-source-frame QA. The source selector indicates the radar's published wind capability, not the currently chosen playback mode. **Choose 'Doppler — All available' under the playback-window control**; '30 min — Rain radar' purposely shows no wind. Never silently fallback to random or historical wind imagery when the BoM source is down.
