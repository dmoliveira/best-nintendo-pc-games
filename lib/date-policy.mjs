const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCalendarKey(value) {
  if (typeof value !== "string") return null;
  const match = value.match(DATE_ONLY);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return null;
  return value;
}

export function localTodayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function compareCalendarKeys(left, right) {
  const leftKey = parseCalendarKey(left);
  const rightKey = parseCalendarKey(right);
  if (!leftKey || !rightKey) return null;
  return leftKey === rightKey ? 0 : leftKey < rightKey ? -1 : 1;
}
