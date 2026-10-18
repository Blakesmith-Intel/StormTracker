# StormTracker — live BoM tropical cyclone FTP → Cloudflare relay delivery

18 October 2026, PR [#177](https://github.com/Blakesmith-Intel/StormTracker/pull/177). **Prepared in review, NOT deployed to the production relay.** Live root remains sealed `v10.2.2` until end-to-end transport is verified.

## Source and state

The existing BoM anonymous FTP `/anon/gen/fwo/` was **successfully listed by GitHub Actions on 18 October 2026** using exact official product codes, with no cyclone GML or advice products found at the sampled UTC. Tests confirm the authentic original GML parser decodes source forecast positions and original polygons, including issued 72 h / 120 h uncertainty if present. We never infer polygons or extrapolate cyclone movement.

The pipeline polls at 10-minute scheduled intervals (best effort; GitHub may delay runs) and maintains a 30-minute maximum browser-source age. The Worker stores exactly one newest source-verified manifest. A complete read of BoM's live product directory (at least 1,000 filenames) with no monitored Queensland/NT cross-border forecast GML **and** no cyclone advice/warning products authoritatively verifies *absence of the monitored issued cyclone products*. The programme additionally tries BoM's HTTP warning summaries. On 18 October the GitHub runner could fetch **zero bytes** from both public BoM HTML warning pages despite a successful anonymous FTP listing, so the official directory is the working negative source. Metadata `warningStatusEvidence` records which check supported any no-warning status.

An active GML issue can be displayed only if the product filename exists, FTP download succeeds, the productId matches the original source, the GML parses fully, geometry/CRS is valid, original issue time is not future-dated or expired, and the browser independently validates original role/vertices. If a cyclone advice exists without readable original forecast map, the result is **unavailable**, never a clean no-warning report. Multiple simultaneous cyclone IDs remain separate; the newest issued file for a given system wins.

The UI continues to show original-source forecast points, observed/forecast tracks and genuine BoM likely-tracks polygons and links the official warning page. It refreshes the source **every five minutes even when the map overlays are off**, plus manually. No historical Jasper/Alfred/GML sample controls or reference files are reinstated into the production root. It displays `Currently no tropical cyclone warnings` only after a verified fresh empty source; all stale, incomplete, malformed, unauthorised, missing and failed cases show `Unable to verify current tropical cyclone warnings` instead.

## Delivery mechanics

- `scripts/refresh-bom-cyclone-live.py` uses runner-side `curl` anonymous FTP, official source inventory and the original tested Python decoder. It emits one JSON snapshot to `RUNNER_TEMP`, outside the public repository tree.
- `.github/workflows/refresh-cyclones.yml` polls every 10 minutes, performs both Python and JavaScript tests, then writes the **short-lived source manifest** to a dedicated existing-account Cloudflare Workers KV namespace (`stormtracker-live-cyclone-snapshots-v1`). Original raw GML is not checked into GitHub.
- `scripts/cyclone-live-kv.mjs` provisions exactly that Cloudflare KV namespace via account API, configures a temporary Wrangler binding, and publishes the validated snapshot. A source upload cannot assert no warnings without verified evidence.
- The **existing** `relay/worker.js` exposes `GET /cyclones` with source-age, status, identity, and no-warning guards. The other radar, Doppler, flood-gauge and incidents routes are untouched.
- The current-only production cyclone JS module is copied into the build from the maintenance source and its import is cache-busted without changing the sealed radar/volume runtime or data. Pages continues to preserve separate historical QA previews.

## Verified tests and confirmed deployment blocker

- [Live FTP source smoke, run 39086151505](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39086151505): **PASS** — current BoM FTP warning product directory reachable; `no-active-products` recorded only after a verified original directory/official advice absence; no source products at that sample time.
- Frontend + original source tests + production Pages dry-run: **PASS** on the candidate prior to the Cloudflare permission smoke.
- [Cloudflare Workers KV permission smoke, run 39086206726](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39086206726): **FAIL** — existing GitHub secret `CLOUDFLARE_API_TOKEN` was present but Cloudflare returned HTTP **401**, code **10000**, `Authentication error` on `GET /accounts/{account_id}/storage/kv/namespaces`. The existing token has not been proved authorised to use the KV API. **Do not merge/replace the working relay while that fails.**

### Required account permission (no credentials in chat)

Cloudflare Dashboard → My Profile → API Tokens: create or update an appropriately scoped token for the same `CLOUDFLARE_ACCOUNT_ID` account, with **Account → Workers KV Storage → Edit/Write** as well as the existing **Account → Workers Scripts → Edit** required by the original Worker deployment. Replace the GitHub Actions repository secret `CLOUDFLARE_API_TOKEN` securely in GitHub repository Settings → Secrets and variables → Actions. Never paste account ID or secret into conversation, source, PR comments or logs. Then rerun the KV smoke workflow for PR #177; when green, approve a controlled merge, verify Worker deployment, run the source-refresh workflow, and check the live `/cyclones` JSON and public browser states.

Source references:
- BoM anonymous FTP and terms: https://www.bom.gov.au/catalogue/anon-ftp.shtml
- Official GML/advice product IDs: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_warning_products_user_guide.pdf
- Cloudflare KV permissions: https://developers.cloudflare.com/api/resources/kv/subresources/namespaces/methods/list/

**Publication rights:** BoM's public FTP files are free to access but **are not automatically CC BY 4.0 for public redistribution**. The CC BY 4.0 wording on BoM cyclone map credits Geoscience Australia basemap data, not necessarily cyclone forecasts. Confirm the specific BoM publication/registered-user rights before exposing GML-derived geometry on a public GitHub Pages/Workers service. Operator-approved internal use alone does not restrict public accessibility. Keep source attribution and the non-operational warning disclaimer.
