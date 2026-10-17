# StormTracker — authorised internal cyclone ingestion (development QA)

**17 October 2026. Operator-declared access scope: internal Queensland Government staff with appropriate data approval.** This is a development branch, not a production activation. The source repository and the GitHub Pages URL remain **publicly accessible** at the time of this work; an operator statement of private intended use does **not** protect material deployed there.

## Source and reference IDs

The BoM's current warning-products user guide (v2.8, 30 July 2026) documents five relevant geographically issued GML tracks with source file names on anonymous FTP. This phase polls original `IDQ65248.gml`, `IDQ65249.gml`, `IDQ65250.gml`, `IDQ65252.gml` (QLD/NSW), and `IDD65409.gml` (NT-issued system affecting QLD). It does not scrape BoM's tropical cyclone webpage, reverse-engineer a private API or make up polygons.

- Official map and bulletin landing page: https://www.bom.gov.au/weather-and-climate/specialised-forecasts-and-observations/tropical-cyclone
- Product directory: `ftp://ftp.bom.gov.au/anon/gen/fwo/`
- Source product guide: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_warning_products_user_guide.pdf
- Anonymous FTP terms: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_Anonymous_FTP_Service_user_guide.pdf

`IDQ20023` is **QLD Tropical Cyclone Advice 1**, one of several advice/bulletin streams (`IDQ20023/26/29`). It is **not** a cyclone identifier or the same payload as `IDQ65248/49/50` issued GML. Advice text, CXML and CAP require independent source-specific parsers and cautious issue/event matching. They are **not yet automatically ingested** by this first stage.

## Delivered on the isolated development branch

`scripts/internal-cyclone-ftp-ingest.py` uses the existing independent `scripts/decode-bom-issued-cyclone-gml.py` original-BoM GML parser, not derived/synthesised tracks. It obtains each allowlisted original `*.gml` from documented BoM anonymous FTP using `curl` or reads copies already acquired through approved internal channels. It checks authentic product identity, source issue UTC, source expiry, whether any forecast fixes/tracks exist, and the source's original geographic geometry. Products older than their issued expiry are removed. Multiple active cyclone IDs remain independent, and duplicate geographical product streams are deduplicated by exact original cyclone ID and freshest original issue.

The resulting `cyclones.json` file uses a **separate private-only manifest**, never Pages assets. It includes only current original source geometries, issue/expiry, original product identifiers and source URLs/hashes, no credentials. Its status is `active`, `no-active-products` (verified absent or expired) or `source-unavailable` (fetch/decode failure), with a `complete` indicator and explicit failure list. The directory and the atomic file are created with restricted `0700`/`0600` permissions. Any output path inside the repository checkout is refused. The code starts no worker, listener, background poller or unauthenticated endpoint.

The source-file format and validation can be tested **without cyclone season** using local originals or synthetic test fixtures; live delivery still requires an appropriately deployed private source transport and a valid original real-time product.

## Internal operations example

Run on an **access-controlled internal host, not GitHub Actions/Pages**. Ensure `curl` and Python 3.10+ are available:

```sh
python3 scripts/test-internal-cyclone-ingest.py
python3 scripts/internal-cyclone-ftp-ingest.py \
  --fetch-ftp --out-dir /var/lib/stormtracker-private/cyclones
```

Alternatively, test downloaded originals without any network:

```sh
python3 scripts/internal-cyclone-ftp-ingest.py \
  --input-dir /private/approved-bom-originals \
  --out-dir /var/lib/stormtracker-private/cyclones
```

Run the single-shot command in your **internal** scheduler at a conservative 5-minute interval if authorised. Do not commit `cyclones.json`, send it as a public Pages artifact or put it into an unauthenticated Cloudflare Worker KV/cache/R2 bucket. Set access policy and audit logging on the service actually delivering it. **Never treat a missing response, FTP outage or invalid XML as evidence that there is no cyclone.**

## Remaining critical integration steps

1. Verify the actual internal access-controlled hosting arrangement. The present public GitHub Pages app shell is not an access control. Decide how approved staff authenticate to a private same-origin feed. Do not put an API key or BoM registered-user password in JS or the repo.
2. Connect a separate private read-only route for `cyclones.json` with identity enforcement, security headers (`Cache-Control: private, no-store`), no public CORS wildcard, no unauthenticated static serving and expiry-based removal.
3. Add the source-validated active forecast overlay and status to the isolated browser preview, reuse original polygon/track rendering, enable only when authorised and explicitly selected, and preserve the current historical panel/provenance labels.
4. Integrate the `IDQ20023/26/29` advice stream and independent CAP/CXML streams after proving real issued XML/text field names. Match by original event ID + compatible issue UTC; a product-slot code is not sufficient. Show the original BoM advice link/text attribution, while 72h/120h source polygons come **only** from the GML.
5. With a genuinely issued cyclone, exercise active, corrected, superseded and expired issues, twin storms, outside-QLD boundary cases, CORS/auth failures and UI camera focus. Then operator visual sign-off. Preserve V10.1.1 sealed production throughout.

## Current acceptance

- Private ingestion engine: **development source committed; NOT yet verified against a live Queensland issued GML.**
- Offline fixture tests: **added**; do not claim green execution until CI or a local runner reports success.
- Internal distribution/authentication: **not configured or tested**.
- Opt-in original cyclone GML UI: **source-connected in isolated QA code only**, but no authenticated private feed deployment exists yet. Historical QA and sealed production unchanged.
- Live advice / CAP / CXML matching: **not connected**; `IDQ20023/26/29` remain the documented bulletin IDs, not the GML maps.

## Isolated QA browser handoff (not deployed internally)

The `/preview/incremental-3d/` module now mounts **Internal live QA** within the existing floating cyclone panel. The operator must explicitly enable it; no background fetch is made when off. It requests only `GET /internal/cyclones.json` from the browser's **same origin** with same-origin credentials and `cache: no-store`, requires JSON rather than a redirected sign-in page, applies size limits, validates original product IDs/source hash/issue/expiry/source forecast geometry and refuses absent/stale/malformed input. The source is rechecked conservatively every five minutes while selected; disabling clears all Cesium entities immediately. It can select multiple authentic simultaneous cyclone systems, focus through the existing map-camera controller, and shows original 72h/120h likely-tracks areas only if the source actually supplied them. Historical observed-only maps are still separate; no live source data or credentials are bundled.

**Critical security note:** a static GitHub Pages site cannot securely provide `/internal/cyclones.json` or prove Queensland Government employee authorisation. Serve that URL through a truly restricted, identity-enforcing **internal host** using actual organisation access controls. Simply hosting a JSON file in an unlisted route is **not secure**. On existing public Pages, the toggle will fail closed and display source unavailable; never substitute an open unauthenticated public Cloudflare route. Access policy, reverse proxy, scheduled FTP fetch and end-to-end live cyclone validation are still deployment tasks. Only accept user-visible status `active` after genuine fresh original BoM input.

Browser data-contract regression suite: `frontend/tests/run-internal-cyclone-feed-v1-tests.mjs`; Python ingestion tests are invoked by `frontend/tests/run-internal-cyclone-ingest-v1-tests.mjs`. Both are now included in standard `npm test` discovery.
