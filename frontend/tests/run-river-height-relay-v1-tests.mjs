import assert from "node:assert/strict";

import worker from "../../relay/worker.js";

const originalFetch =
  globalThis.fetch;

const htmlFor =
  product => `
<html>
<table>
<tr>
  <th>Station Name</th>
  <th>Time/Day</th>
  <th>Height</th>
  <th>Tendency</th>
  <th>Flood Class</th>
  <th>Recent Data</th>
</tr>
<tr>
  <td>Station ${product}</td>
  <td>2.30pm Wed</td>
  <td>1.23 m</td>
  <td>Rising</td>
  <td>Below Minor</td>
  <td><a href="/recent?id=${product.slice(-5)}">Table</a></td>
</tr>
</table>
</html>
`;

const calls = [];

globalThis.fetch =
  async url => {
    const target =
      String(url);

    calls.push(
      target
    );

    if (
      target.includes(
        "IDQ60296"
      )
    ) {
      return new Response(
        "upstream unavailable",
        {
          status:
            503
        }
      );
    }

    const match =
      target.match(
        /IDQ602\d{2}/
      );

    assert.ok(
      match,
      `Unexpected relay upstream: ${target}`
    );

    return new Response(
      htmlFor(
        match[0]
      ),
      {
        status:
          200,

        headers: {
          "Content-Type":
            "text/html"
        }
      }
    );
  };

try {
  const response =
    await worker.fetch(
      new Request(
        "https://relay.invalid/river-height-bulletins"
      ),
      {}
    );

  assert.equal(
    response.status,
    200
  );

  assert.equal(
    response.headers
      .get(
        "Cache-Control"
      ),
    "public, max-age=300"
  );

  const payload =
    await response.json();

  assert.equal(
    payload.format,
    "StormTrackerRiverHeightBulletinsV1"
  );

  assert.equal(
    payload.partial,
    true
  );

  assert.equal(
    payload.source_products
      .length,
    12
  );

  assert.equal(
    payload.products
      .length,
    11
  );

  assert.equal(
    payload.failed
      .length,
    1
  );

  assert.equal(
    payload.failed[0]
      .product,
    "IDQ60296"
  );

  assert.deepEqual(
    payload.products[0]
      .observations[0],
    {
      stationName:
        "Station IDQ60285",
      stationId:
        "60285",
      heightMetres:
        1.23,
      tendency:
        "rising",
      floodClass:
        "below-minor",
      observedText:
        "2.30pm Wed",
      recentDataHref:
        "/recent?id=60285",
      sourceProduct:
        "IDQ60285"
    }
  );

  assert.equal(
    calls.filter(
      url =>
        url.includes(
          "IDQ60296"
        )
    ).length,
    2,
    "A failed product must try both official BoM URL forms."
  );

  assert.equal(
    calls.some(
      url =>
        url.includes(
          "/fwo/IDQ60285.html"
        )
    ),
    true
  );

  const head =
    await worker.fetch(
      new Request(
        "https://relay.invalid/river-height-bulletins",
        {
          method:
            "HEAD"
        }
      ),
      {}
    );

  assert.equal(
    head.status,
    200
  );

  assert.equal(
    await head.text(),
    ""
  );
} finally {
  globalThis.fetch =
    originalFetch;
}

console.log(
  "River-height relay checks passed: fixed 12-product allow-list, official BoM URL fallback, server-side parsing, partial-feed survival and five-minute cache headers."
);
