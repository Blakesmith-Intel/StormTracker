# StormTracker — BoM cyclone product access: real network audit, 17 October 2026

**Verification complete via GitHub-hosted network runner.** Evidence: [successful one-shot workflow run](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39010366312), job `probe`. No original BoM files were committed or distributed.

## Actual results (not mocked)

- Anonymous FTP: `ftp://ftp.bom.gov.au/anon/` **reachable from GitHub-hosted runner**.
- Original genuine BoM Fina `ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/IDD65401.gml`: **successful FTP retrieval**, exactly **265,470 bytes**.
- Independent original-BoM parser `scripts/decode-bom-issued-cyclone-gml.py` accepted the downloaded sample, identity **Fina**, issue **2025-11-20T06:53:03Z**, **41** total features, **10** source forecast fixes, **2** authentic source uncertainty-area polygons. No forecast positions or polygons were invented.
- Current `ftp://ftp.bom.gov.au/anon/gen/fwo/` FTP directory: **successful anonymous listing** with **5,126 file entries**.
- At probe time, no exact file names `IDQ65248.gml`, `IDQ65249.gml`, `IDQ65250.gml`, `IDQ65252.gml`, nor candidate advice `IDQ20023/26/29.txt|xml|html`, appeared in that listing. **Absence does not imply transport failure**; warning products are not issued continuously and are deleted after their retention time. This is not evidence of no cyclone anywhere.

### Exactly what this proves

**Proven now:** upstream anonymous FTP network access, directory listing, retrieval of an original archived issuance, authentic GML schema/geometry decoding; no government user login is needed for these anonymous sources.

**Not proven yet:** actual fresh Queensland-issued GML or `IDQ20023` advice file while a cyclone is active; automatic pairing of an advice bulletin to the correct forecast issue, or an HTTPS browser-usable source. The test's absence check is *directory/file-name exact*; future issued products may use other extension/format conventions and require field inspection.

## Live integration consequence

No authenticated **BoM** feed is technically required for anonymous FTP products under applicable use terms. However browsers cannot fetch FTP and a standard Cloudflare Worker `fetch()` makes HTTP(S) requests only. **A genuinely working FTP-to-HTTPS transport bridge or independently verified BoM HTTPS source is still necessary** to feed the browser on each new issue. Public visibility of GitHub Pages is not itself an access-control mechanism and the existing private-only QA feed is deliberately not configured. Do not present historical sample products as live or an unavailable source as all-clear.

Use the existing source-decoder/geometry renderer, retain source UTC + expiry + attribution, and avoid introducing unnecessary employee sign-in requirements merely to consume public weather warnings. This evidence supports moving to a guarded QA browser rollout, **not yet declaring automatic live ingestion end-to-end**.

BoM official FTP guide: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_Anonymous_FTP_Service_user_guide.pdf
BoM warning products guide: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_warning_products_user_guide.pdf
