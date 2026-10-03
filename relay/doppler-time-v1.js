const MONTHS =
  Object.freeze({
    Jan:0,
    Feb:1,
    Mar:2,
    Apr:3,
    May:4,
    Jun:5,
    Jul:6,
    Aug:7,
    Sep:8,
    Oct:9,
    Nov:10,
    Dec:11
  });

export function parseBomReceivedAtUtc(
  html
) {
  const text =
    String(
      html
      ?? ""
    )
      .replace(
        /&nbsp;|&#160;/gi,
        " "
      )
      .replace(
        /<[^>]*>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const match =
    text.match(
      /Received at:\s*(\d{1,2}):(\d{2})\s*UTC\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{4})/i
    );

  if (!match) {
    return null;
  }

  const [
    ,
    hourText,
    minuteText,
    dayText,
    monthText,
    yearText
  ] =
    match;

  const monthName =
    monthText[0].toUpperCase()
    + monthText
      .slice(1)
      .toLowerCase();

  const month =
    MONTHS[
      monthName
    ];

  if (
    month == null
  ) {
    return null;
  }

  const year =
    Number(
      yearText
    );

  const day =
    Number(
      dayText
    );

  const hour =
    Number(
      hourText
    );

  const minute =
    Number(
      minuteText
    );

  const epoch =
    Date.UTC(
      year,
      month,
      day,
      hour,
      minute,
      0,
      0
    );

  if (
    !Number.isFinite(
      epoch
    )
  ) {
    return null;
  }

  const date =
    new Date(
      epoch
    );

  if (
    date.getUTCFullYear()
      !== year
    || date.getUTCMonth()
      !== month
    || date.getUTCDate()
      !== day
    || date.getUTCHours()
      !== hour
    || date.getUTCMinutes()
      !== minute
  ) {
    return null;
  }

  return date
    .toISOString();
}
