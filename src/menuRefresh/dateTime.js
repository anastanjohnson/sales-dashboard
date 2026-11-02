// Restaurant schedules always use Berlin time, independently of the browser's zone.
const RESTAURANT_TIME_ZONE = "Europe/Berlin";
const DAY_MS = 24 * 60 * 60 * 1000;
const berlinFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: RESTAURANT_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function berlinParts(milliseconds) {
  return Object.fromEntries(berlinFormatter.formatToParts(new Date(milliseconds))
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
}

function inputFromParts(parts) {
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Reject zone-less strings so Date.parse cannot fall back to the device's zone.
function instantMilliseconds(value) {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return NaN;
  return Date.parse(value);
}

/** Convert a saved instant to a minute-precision datetime-local value in Berlin. */
export function formatBerlinDateTimeInput(availableAt) {
  const milliseconds = instantMilliseconds(availableAt);
  return Number.isFinite(milliseconds) ? inputFromParts(berlinParts(milliseconds)) : "";
}

/**
 * Convert a Berlin wall-clock input to canonical UTC. Empty input clears the date.
 * Spring's skipped times are rejected; autumn's repeated times use the earlier instant.
 */
export function parseBerlinDateTimeInput(value) {
  if (value == null || value === "") return null;
  const match = typeof value === "string"
    && /^((?:20\d{2}|2100))-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid date and time between 2000 and 2100 (Europe/Berlin).");

  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallMilliseconds = Date.UTC(year, month - 1, day, hour, minute);
  const wallDate = new Date(wallMilliseconds);
  if (wallDate.getUTCFullYear() !== year || wallDate.getUTCMonth() !== month - 1
    || wallDate.getUTCDate() !== day || wallDate.getUTCHours() !== hour
    || wallDate.getUTCMinutes() !== minute) {
    throw new Error("Enter a valid calendar date and time (Europe/Berlin).");
  }

  // Nearby instants reveal both Berlin offsets when this date is a DST transition.
  const offsets = new Set([-DAY_MS, 0, DAY_MS].map((distance) => {
    const sample = wallMilliseconds + distance;
    const parts = berlinParts(sample);
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)) - sample;
  }));
  const matches = [...offsets].map((offset) => wallMilliseconds - offset)
    .filter((candidate) => inputFromParts(berlinParts(candidate)) === value);
  if (!matches.length) {
    throw new Error("This time does not exist in Europe/Berlin because the clocks change. Choose another time.");
  }
  return new Date(Math.min(...matches)).toISOString();
}

/** Return elapsed-time countdown units, or null when no valid instant is set. */
export function getCountdownParts(availableAt, nowMs = Date.now()) {
  const availableMs = instantMilliseconds(availableAt);
  if (!Number.isFinite(availableMs) || !Number.isFinite(nowMs)) return null;
  // Keep one second visible until the actual instant, rather than becoming available early.
  const totalSeconds = Math.max(0, Math.ceil((availableMs - nowMs) / 1000));
  return {
    totalSeconds,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds % 86400 / 3600),
    minutes: Math.floor(totalSeconds % 3600 / 60),
    seconds: totalSeconds % 60,
    isAvailable: availableMs <= nowMs,
  };
}
