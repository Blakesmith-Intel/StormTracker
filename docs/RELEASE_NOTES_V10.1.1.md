# StormTracker V10.1.1 — 17 October 2026

**Accepted immutable source:** `711d65a72a483b319e80711a09cfeabe2f69bbcd`

**Public marker:** `SEALED StormTracker V10.1.1 source 711d65a72a483b319e80711a09cfeabe2f69bbcd`

## Accepted UI correction

The map **Hide controls** button previously hid the controls without reclaiming their grid allocation: a stronger `body.simple-ui #app` selector overrode the older `#app.sidebar-collapsed` desktop and mobile map sizing. The high-specificity collapsed override now removes **both** the desktop sidebar column **and** the mobile controls row, stretches Cesium's map panel across all available width/height, and restores the original compact UI with Show controls. The iframe and stylesheet URLs are cache-busted to deliver the correction to existing users. Targeted tests protect the full-size behaviour.

## Unchanged accepted weather science and features

Preserves exactly the accepted V10.1.0 Doppler timeline and rain-style prepare/stage/commit for all selected BoM wind radars, ±8-minute genuine source timestamp tolerance, and Brewarrina `IDR93I` via one existing production Cloudflare Worker. Moree and Grafton rain only. All native measured rain imagery, inferred ≥40 dBZ 3-D, source colours, QLD/NSW imagery, labels, incident layers, single sidebar, performance controls and legacy rollback points unchanged. Brewarrina source-image science registration remains provisional.

## Seal policy

V10.1.1 is promoted only after full suite, exact source package, public site/build marker and CSS/HTML/source smoke checks. Annotated `v10.1.1` and `restore/v10.1.1` are created at `711d65a72a483b319e80711a09cfeabe2f69bbcd` after successful deployment. Prior sealed `v10.1.0` remains pinned at `11f0012170c4632bd5ef2448bf5671326fdd287e` and is never changed.
