# Brewarrina Doppler — one production relay (17 October 2026)

## Diagnosis and removed detour
Brewarrina genuinely publishes a Doppler wind product, `IDR93I`. In the first development build, the frontend routed that site to an invented **second** Cloudflare Worker (`stormtracker-bom-relay-nsw-preview`). That endpoint returned HTTP 404. Attempting to deploy the second Worker (GitHub [run 38992834511](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/38992834511)) returned a Cloudflare **No access to the specified resource** error. This was an unnecessary architectural detour, not a requirement of Brewarrina Doppler.

The already operating **production** Worker `stormtracker-bom-relay` uses a strict whitelist sourced from `BORDER_RADAR_DOPPLER_PRODUCTS`. Repository source already lists `IDR93I` alongside approved Queensland products, but the deployed worker rejected Brewarrina with 403 (stale deployed catalogue). The correct fix is to deploy the new repository Worker version to the EXISTING production service and route all supported sites through it.

## Final architecture
- One existing Cloudflare Worker: `stormtracker-bom-relay`.
- One browser Doppler relay URL: `https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev`.
- The existing `relay/wrangler.jsonc` and `.github/workflows/deploy-relay.yml` deploy to that same Worker. No second NSW Worker or workflow.
- Product checks and timestamps remain unchanged. Moree and Grafton remain rain-only.
- Production V10.0.0 UI stays pinned independently from QA additions.

## Verification still required
Check `/radar-history?product=IDR93I`. HTTP 200 with authentic timestamped image filenames confirms feed history is available. HTTP 502 means genuine BoM upstream denial or empty history and must not be treated as a loaded Doppler layer. GitHub's direct network currently receives 403 from BoM for the wind product; Cloudflare's upstream connectivity needs its own real test. A reachable source does not prove pixel georegistration accuracy: `analysisGeorefVerified=false` until real source-control-point checks succeed.

For Doppler playback in the app, select **Doppler — All available**; **30 min — Rain radar** intentionally shows only reflectivity.
