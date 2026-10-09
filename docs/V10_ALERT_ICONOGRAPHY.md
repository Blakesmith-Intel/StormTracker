# StormTracker V10 — severe radar candidate symbology

**Research preview only** — do not confuse a StormTracker candidate with an official Bureau of Meteorology warning, a tornado confirmation or a BoM 90/125 km/h *surface gust*.

## Exactly three category-based styles

| Detector category | Display label | Map-pin icon | Colour | HEX |
|---|---|---|---|---|
| `strong_radial_signature` | **STRAIGHT-LINE WIND?** | Three dynamic gust streaks | Yellow | `#F6D94F` |
| `hook_shape_only` | **HOOK ECHO?** | Original bent radar arc ending in a hook | Orange | `#FF963F` |
| `tornadic_candidate` | **TORNADIC CIRCULATION?** | Tapering five-stroke tornado/funnel | Red | `#D83045` |

**Icon design principle:** the orange radar echo is a hooked/J-shaped *reflectivity outline*, explicitly different from the red tapered tornado/funnel. Neither the icon nor colour by itself conveys certainty.

### Sources of truth
- Names, classification fallbacks, colours and SVG names: `frontend/src/severe-storm-alert-appearance-v10.js`.
- SVG files: `frontend/assets/v10-gust.svg`, `frontend/assets/v10-hook.svg`, `frontend/assets/v10-tornado.svg`.
- DOM rendering (pin, dock row, detail header): `frontend/src/severe-storm-alert-overlay-v1.js`.
- Responsive map+row+detail CSS: `frontend/src/operational-dashboard-v9-1.css` (`.v10-wind`, `.v10-hook`, `.v10-tornado`).
- Regression suite: `frontend/tests/run-v10-alert-icon-mapping-tests.mjs`.

### Exact UI rules
- Each map marker has its own saturated-colour circular background and high-contrast icon.
- Alert dock rows are dark with category-coloured border, coloured label and a compact coloured icon badge.
- Detail header repeats the same icon, classification label and category colour.
- Icon assets are vector-only, transparent, prebuilt static files with no JavaScript and no external resources.
- Icons are decorative to assistive technologies (`alt=""`, `aria-hidden="true"`), while each clickable pin provides a complete descriptive text alternative and source uncertainty.
- Pins and rows keep keyboard focus outlines. Buttons must remain clickable and display independent of animation advancement.
- On a source/radar switch, alert data is reset by the existing overlay; no stale category gets carried into a new region.
- Where `category` is unrecognised, show neutral, unclassified research iconology; **never** infer a tornado category from an unknown type.
- V10 switch is **OFF by default**; sealed V9 baseline and its disabled research toggles are not changed.

### Labels deliberately remain uncertain
- `STRAIGHT-LINE WIND?` means **strong same-direction radar radial-wind signature**. It is not a 90 km/h or 125 km/h measured surface gust and is not proof of a downburst.
- `HOOK ECHO?` means a potential reflectivity hook in two measured scans but **no verified tornadic circulation**.
- `TORNADIC CIRCULATION?` means colocated persistent-hook and compact signed Doppler couplet satisfying experimental rules. It is **not** a confirmed tornado or official BoM warning.

**Operational release gate:** Original-source historical case acceptance + live-browser visual review on iOS/desktop + scientific validation must happen *before* production merge/tag.
