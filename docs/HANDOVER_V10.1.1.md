# StormTracker V10.1.1 — Sealed production handover

**Exact immutable release source:** `711d65a72a483b319e80711a09cfeabe2f69bbcd`. After public deployment: tag `v10.1.1`, restore `restore/v10.1.1`.

**Preserve earlier:** `v10.1.0` and `restore/v10.1.0` at `11f0012170c4632bd5ef2448bf5671326fdd287e`; `v10.0.0` and previous V9 versions remain as previously sealed.

## Accepted change

`frontend/src/single-interface-v1.css` appends the higher-specificity `body.simple-ui #app.sidebar-collapsed` selector **after** mobile media rules. This forces one full-width and full-height grid cell, hides the control sidebar and spans `#mapPanel` over the cell. The original `frontend/src/live3d-operational-v9.js` `setSidebarCollapsed` toggler and Cesium `viewer.resize` are unchanged. CSS link version `full-map-toggle-20261017-v2` and outer `index.html` iframe cache token `hide-controls-full-map-v1` ensure current clients receive it. Static operator regression verifies selector precedence/layout dimensions across desktop and mobile.

Everything else is identical to the source accepted for V10.1.0, including full-fidelity 3-D, independently published BoM timestamps for synchronised multi-site Doppler, radar/motion cone functions, regional satellite/map navigation, source layers and scientific caveats. No new Worker, preview UI, controls or source-data dependence.

## Release flow and recovery

`scripts/build-current-site.sh` must always build live root from `checked/production-v10.1.1`, which Pages checks out at the exact SHA above, never moving `main`. Validations and public BUILD/asset smoke checks run **before** release refs seal. If needed, recover from a prior immutable tag with a new reviewed release. The remaining next development milestone is official BoM cyclone forecast track and published uncertainty geometry; do not invent data.
