# StormTracker BOM relay

This Worker is a deliberately narrow transport relay.

It:
- accepts only GET/HEAD/OPTIONS;
- accepts only `/wmts`;
- accepts only the BOM reflectivity layer currently used by StormTracker;
- accepts browser requests only from `https://blakesmith-intel.github.io`;
- fetches the public BOM WMTS tile server-side;
- adds CORS headers so StormTracker can read the PNG pixels in-browser.

It does **not** perform storm segmentation, tracking, modelling, inference or 3-D processing.
All science remains in the StormTracker browser application.
