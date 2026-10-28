# StormTracker V10.2.28 — clear and product-specific BoM warning status

**Date:** 28 October 2026 (Queensland AEST)  
**Change:** Operator-facing warning status and isolated browser fetch recovery. All previous radar, flood, rainfall, Doppler, traffic, power, QFD and geographical science remain unchanged. `v10.2.27` and all previous restore points remain immutable.

## Operational negative reporting

A completed source-verified **no-active** or **cancelled** result is normal, useful situational awareness, not an error.

- With all monitored BoM warning products positively confirmed clear, the warning status reads **No current warnings**.
- If `IDQ21033` or `IDQ21035` is confirmed clear in its own filter, the status reads **No current warnings — IDQ21033 (Regional QLD)** or **No current warnings — IDQ21035 (Detailed SEQ)**.
- When one thunderstorm product is active, name its exact product number, indicate its live polygon count, and independently state that the other product has no current warnings when verified.
- When both thunderstorm products are confirmed clear but other severe-weather warning products cannot be verified, report **No current thunderstorm warnings** and explicitly state the narrower verification scope. Never imply a statewide all-clear for unverified warning products.
- If BoM confirms an active warning bulletin but geospatial polygons are missing, continue to report the **active warning and missing polygon**; do not suggest no warnings.
- If the latest network request fails, show neutral **Unable to confirm current BoM warnings** and offer manual refresh. Do not turn network failure into an official no-warning result or retain unverified stale polygons. A transient browser `Load failed` is retried once before reporting unavailability.

The source polling rate remains **15 minutes**, with manual refresh supported. Changes are confined to the existing optional BoM severe-warning overlay and the site-linked operator guide. A new production seal/restore reference is created only after the published site module is verified to contain the correct behaviour.
