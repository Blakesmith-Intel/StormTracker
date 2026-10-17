# Brewarrina Doppler transport live-recovery (17 October 2026)

The 17 Oct GitHub-hosted probe of exact configured endpoints proved this is an infrastructure break, **not** an inaccurate source catalogue:

- `https://stormtracker-bom-relay-nsw-preview.stormtracker-bom-relay.workers.dev/radar-history?product=IDR93I` → **HTTP 404**.
- Same NSW preview `/radar?product=IDR93I` → **HTTP 404**.
- Deployed original Queensland worker `/radar-history?product=IDR93I` → **HTTP 403**, `Doppler product not allowed` (its deployed revision predates the 93 allowlist).
- Direct BoM `IDR93I.loop.shtml` and `/radar/IDR93I.gif` from GitHub's runner → **HTTP 403 / Access Denied**. This does not establish whether Cloudflare's worker can read the same public pages; the worker must be tested independently.

GitHub `.github/workflows/deploy-nsw-doppler-preview.yml` now has a **scoped deployment** for the existing `relay/wrangler-nsw-preview.jsonc` Worker, triggered by relevant source changes on `main`. It runs source-validation tests and then deploys only `stormtracker-bom-relay-nsw-preview`; does **not** redeploy or change the accepted Queensland worker or immutable V10.0.0 production. GitHub Actions requires both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets as specified by the existing manual relay workflow.

Run results must explicitly show HTTP status of the NSW Worker. A successful deployment or source response is **not** proof of pixel/georegistration accuracy, which still requires authentic-source-frame QA. The source selector indicates the radar's published wind capability, not the currently chosen playback mode. **Choose 'Doppler — All available' under the playback-window control**; '30 min — Rain radar' purposely shows no wind. Never silently fallback to random or historical wind imagery when the BoM source is down.

## Live deployment result and least-privilege recovery

Run [38992834511](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/38992834511), executing the narrowly scoped NSW preview Worker deploy, **FAILED** at Wrangler v4 deployment with:
`A request to the Cloudflare API (/accounts/***/workers/scripts/stormtracker-bom-relay-nsw-preview/deployments) failed. No access to the specified resource.`
The workflow's GitHub environment printed masked nonempty `apiToken` and `accountId` settings, so it reached the Cloudflare API. This is insufficient access to deploy the NEW script, not a JS build problem.

**Least-privilege recovery:** An authorised Cloudflare account admin should create an empty Worker named exactly `stormtracker-bom-relay-nsw-preview` in the Cloudflare account already used by StormTracker, then grant the existing GitHub Actions token `Editor` permissions scoped specifically to that worker, or use a newly issued appropriately scoped token and update only the repository's `CLOUDFLARE_API_TOKEN` Actions secret. For creating a worker via API rather than the dashboard, Cloudflare documents product-level Workers `Admin` is required; prefer manual creation plus per-worker Editor to avoid broad token access. Never paste the token into a chat or repository. See https://developers.cloudflare.com/workers/authorization/workers/.

Until access is corrected, the deployment workflow is **manual only** to avoid recurring failing automatic deploys. GitHub Actions → `Deploy Brewarrina Doppler isolated NSW preview relay` → Run workflow (main), or rerun the failed run above once permissions are fixed. Confirm the deployment actually returns authentic `IDR93I` history frames and weather pixels before accepting the feature. Direct access to BoM from GitHub CI also returns 403, so Cloudflare-to-BoM source access remains a separate verification gate. Production V10.0.0 and the existing Queensland relay remain untouched.
