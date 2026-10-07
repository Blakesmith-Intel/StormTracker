function decodeEntities(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripCdata(value) {
  return String(value ?? "")
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "");
}

function stripTags(value) {
  return decodeEntities(
    stripCdata(value)
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

function firstTagText(
  block,
  tag
) {
  const match =
    String(block ?? "")
      .match(
        new RegExp(
          `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,
          "i"
        )
      );

  return match
    ? stripTags(match[1])
    : "";
}

function placemarkElements(
  kmlText
) {
  const source =
    String(
      kmlText ?? ""
    );

  const regex =
    /<Placemark\b([^>]*)>([\s\S]*?)<\/Placemark>/gi;

  const elements = [];
  let match;

  while (
    (
      match =
        regex.exec(source)
    )
  ) {
    const attributes =
      match[1]
      ?? "";

    const idMatch =
      attributes.match(
        /\bid\s*=\s*["']([^"']+)["']/i
      );

    elements.push({
      id:
        idMatch
          ? decodeEntities(
              idMatch[1]
            ).trim()
          : "",

      block:
        match[2]
        ?? ""
    });
  }

  return elements;
}

function tagBlocks(
  block,
  tag
) {
  const source =
    String(block ?? "");

  const regex =
    new RegExp(
      `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,
      "gi"
    );

  const blocks = [];
  let match;

  while (
    (
      match =
        regex.exec(source)
    )
  ) {
    blocks.push(
      match[1]
    );
  }

  return blocks;
}

function descriptionFields(
  description
) {
  const html =
    stripCdata(
      description
    );

  const fields =
    new Map();

  const pairRegex =
    /<span\b[^>]*>([\s\S]*?)<\/span>\s*([^<\r\n]*)/gi;

  let match;

  while (
    (
      match =
        pairRegex.exec(html)
    )
  ) {
    const label =
      stripTags(
        match[1]
      )
        .replace(/:\s*$/, "")
        .trim();

    const value =
      stripTags(
        match[2]
      );

    if (
      label
      && value
    ) {
      fields.set(
        label.toLowerCase(),
        value
      );
    }
  }

  const fallbackText =
    stripTags(
      html
        .replace(
          /<\/span>/gi,
          ": "
        )
        .replace(
          /<\/(?:div|p|tr|td|li)>/gi,
          "\n"
        )
    );

  for (
    const line
    of fallbackText
      .split(/\n+/)
  ) {
    const separator =
      line.indexOf(":");

    if (
      separator <= 0
    ) {
      continue;
    }

    const label =
      line
        .slice(
          0,
          separator
        )
        .trim()
        .toLowerCase();

    const value =
      line
        .slice(
          separator + 1
        )
        .trim();

    if (
      label
      && value
      && !fields.has(
        label
      )
    ) {
      fields.set(
        label,
        value
      );
    }
  }

  return fields;
}

function field(
  fields,
  name
) {
  return (
    fields.get(
      String(name)
        .toLowerCase()
    )
    ?? ""
  );
}

function timeZoneOffsetMinutes(
  timeZone,
  epochMs
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        hour:
          "2-digit",
        minute:
          "2-digit",
        second:
          "2-digit",
        hour12:
          false,
        hourCycle:
          "h23"
      }
    )
      .formatToParts(
        new Date(
          epochMs
        )
      );

  const values =
    Object.fromEntries(
      parts
        .filter(
          part =>
            part.type
            !== "literal"
        )
        .map(
          part => [
            part.type,
            part.value
          ]
        )
    );

  const zonedAsUtc =
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

  return Math.round(
    (
      zonedAsUtc
      - epochMs
    )
    / 60000
  );
}

function offsetText(
  minutes
) {
  const sign =
    minutes >= 0
      ? "+"
      : "-";

  const absolute =
    Math.abs(
      minutes
    );

  const hours =
    Math.floor(
      absolute / 60
    );

  const remainder =
    absolute % 60;

  const pad =
    part =>
      String(part)
        .padStart(
          2,
          "0"
        );

  return (
    `${sign}${pad(hours)}:${pad(remainder)}`
  );
}

export function parseEssentialLocalDateTime(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return "";
  }

  const match =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );

  if (!match) {
    return text;
  }

  const [
    ,
    day,
    month,
    year,
    hour,
    minute,
    second = "00"
  ] = match;

  const localAsUtc =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

  let offsetMinutes =
    timeZoneOffsetMinutes(
      "Australia/Sydney",
      localAsUtc
    );

  let epochMs =
    localAsUtc
    - offsetMinutes
      * 60
      * 1000;

  const resolvedOffset =
    timeZoneOffsetMinutes(
      "Australia/Sydney",
      epochMs
    );

  if (
    resolvedOffset
    !== offsetMinutes
  ) {
    offsetMinutes =
      resolvedOffset;

    epochMs =
      localAsUtc
      - offsetMinutes
        * 60
        * 1000;
  }

  const pad =
    part =>
      String(part)
        .padStart(
          2,
          "0"
        );

  return (
    `${year}-${pad(month)}-${pad(day)}`
    + `T${pad(hour)}:${pad(minute)}:${pad(second)}`
    + offsetText(
        offsetMinutes
      )
  );
}

function coordinates(
  text
) {
  return String(
    text ?? ""
  )
    .trim()
    .split(/\s+/)
    .map(
      item =>
        item
          .split(",")
          .slice(
            0,
            2
          )
          .map(Number)
    )
    .filter(
      coordinate =>
        coordinate.length >= 2
        && coordinate.every(
          Number.isFinite
        )
    );
}

function polygonGeometry(
  polygonBlock
) {
  const outerBlock =
    tagBlocks(
      polygonBlock,
      "outerBoundaryIs"
    )[0]
    ?? polygonBlock;

  const outerCoordinates =
    firstTagText(
      outerBlock,
      "coordinates"
    );

  const outer =
    coordinates(
      outerCoordinates
    );

  if (
    outer.length < 4
  ) {
    return null;
  }

  const holes =
    tagBlocks(
      polygonBlock,
      "innerBoundaryIs"
    )
      .map(
        block =>
          coordinates(
            firstTagText(
              block,
              "coordinates"
            )
          )
      )
      .filter(
        ring =>
          ring.length >= 4
      );

  return [
    outer,
    ...holes
  ];
}

function placemarkGeometry(
  placemark
) {
  const polygons =
    tagBlocks(
      placemark,
      "Polygon"
    )
      .map(
        polygonGeometry
      )
      .filter(Boolean);

  if (
    polygons.length === 1
  ) {
    return {
      type:
        "Polygon",
      coordinates:
        polygons[0]
    };
  }

  if (
    polygons.length > 1
  ) {
    return {
      type:
        "MultiPolygon",
      coordinates:
        polygons
    };
  }

  const pointBlocks =
    tagBlocks(
      placemark,
      "Point"
    );

  if (
    pointBlocks.length
  ) {
    const point =
      coordinates(
        firstTagText(
          pointBlocks[0],
          "coordinates"
        )
      )[0];

    if (point) {
      return {
        type:
          "Point",
        coordinates:
          point
      };
    }
  }

  return null;
}

function outageTypeFromStyle(
  styleUrl
) {
  const normalised =
    String(
      styleUrl ?? ""
    ).toLowerCase();

  if (
    normalised
      .includes(
        "unplanned"
      )
  ) {
    return "UNPLANNED";
  }

  if (
    normalised
      .includes(
        "planned"
      )
  ) {
    return "PLANNED";
  }

  return "UNPLANNED";
}

export function parseEssentialEnergyKml(
  kmlText
) {
  const placemarks =
    placemarkElements(
      kmlText
    );

  const features = [];

  placemarks.forEach(
    (
      placemarkElement,
      index
    ) => {
      const placemark =
        placemarkElement
          .block;
      const geometry =
        placemarkGeometry(
          placemark
        );

      const sourcePoint =
        coordinates(
          firstTagText(
            tagBlocks(
              placemark,
              "Point"
            )[0]
            ?? "",
            "coordinates"
          )
        )[0]
        ?? null;

      if (!geometry) {
        return;
      }

      const descriptionMatch =
        placemark.match(
          /<description\b[^>]*>([\s\S]*?)<\/description>/i
        );

      const description =
        descriptionMatch
          ? descriptionMatch[1]
          : "";

      const fields =
        descriptionFields(
          description
        );

      const incidentId =
        field(
          fields,
          "Incident ID"
        )
        || placemarkElement.id
        || firstTagText(
          description,
          "h2"
        )
        || `essential-${index + 1}`;

      const customers =
        Number(
          field(
            fields,
            "No. of Customers affected"
          )
          .replace(
            /[^\d.-]/g,
            ""
          )
        );

      const name =
        firstTagText(
          placemark,
          "name"
        );

      const styleUrl =
        firstTagText(
          placemark,
          "styleUrl"
        );

      features.push({
        type:
          "Feature",

        id:
          `essential:${incidentId}`,

        properties: {
          EVENT_ID:
            incidentId,

          TYPE:
            outageTypeFromStyle(
              styleUrl
            ),

          STATUS:
            "Active",

          CUSTOMERS_AFFECTED:
            Number.isFinite(
              customers
            )
              ? Math.max(
                  0,
                  customers
                )
              : 0,

          SUBURBS:
            name,

          STREETS:
            "",

          START:
            parseEssentialLocalDateTime(
              field(
                fields,
                "Time Off"
              )
            ),

          FINISH:
            "",

          EST_FIX_TIME:
            parseEssentialLocalDateTime(
              field(
                fields,
                "Est. Time On"
              )
            ),

          REASON:
            field(
              fields,
              "Reason"
            ),

          EXTRACTED:
            parseEssentialLocalDateTime(
              field(
                fields,
                "Last Updated"
              )
            ),

          STORMTRACKER_PROVIDER:
            "Essential Energy",

          STORMTRACKER_SOURCE_LONGITUDE:
            sourcePoint?.[0]
            ?? "",

          STORMTRACKER_SOURCE_LATITUDE:
            sourcePoint?.[1]
            ?? ""
        },

        geometry
      });
    }
  );

  return {
    type:
      "FeatureCollection",
    features
  };
}


