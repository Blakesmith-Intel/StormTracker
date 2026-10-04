// AEST is always UTC+10. Never inherit the device's timezone or daylight saving.
function clocks(value) {
  if (!value) return null;
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return null;
  return { utc: new Date(epoch).toISOString(), aest: new Date(epoch + 10 * 3600000).toISOString() };
}

export function formatProductTime(value, { compact = false } = {}) {
  const times = clocks(value);
  if (!times) return 'timestamp unavailable';
  const display = time => compact ? time.slice(11, 16) : `${time.slice(0, 10)} ${time.slice(11, 16)}`;
  return `${display(times.aest)} AEST / ${display(times.utc)} UTC`;
}

export function formatProductTimeRange(start, end) {
  const first = clocks(start), last = clocks(end);
  if (!first || !last) return 'timestamp unavailable';
  const range = zone => {
    const crossesDate = first[zone].slice(0, 10) !== last[zone].slice(0, 10);
    const display = time => crossesDate ? `${time.slice(5, 10)} ${time.slice(11, 16)}` : time.slice(11, 16);
    return `${display(first[zone])}–${display(last[zone])}`;
  };
  return `${range('aest')} AEST / ${range('utc')} UTC`;
}
