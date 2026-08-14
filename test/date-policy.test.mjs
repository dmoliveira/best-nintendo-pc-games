import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { compareCalendarKeys, localTodayKey, parseCalendarKey } from "../lib/date-policy.mjs";

test("accepts only valid calendar dates", () => {
  assert.equal(parseCalendarKey("2026-08-15"), "2026-08-15");
  assert.equal(parseCalendarKey("2026-02-29"), null);
  assert.equal(parseCalendarKey("2026-08-15T23:59:59Z"), null);
  assert.equal(compareCalendarKeys("2026-08-15", "2026-08-14"), 1);
  assert.equal(compareCalendarKeys("2026-08-15T00:00:00Z", "2026-08-14"), null);
});

test("uses the configured local timezone when deriving today's calendar key", () => {
  const script = "import { localTodayKey } from './lib/date-policy.mjs'; process.stdout.write(localTodayKey(new Date('2026-01-01T11:00:00Z')));";
  const runInTimezone = (timezone) => execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: timezone },
    encoding: "utf8",
  });

  assert.equal(runInTimezone("Pacific/Kiritimati"), "2026-01-02");
  assert.equal(runInTimezone("America/Adak"), "2026-01-01");
  assert.equal(localTodayKey(new Date("2026-01-01T11:00:00Z")), runInTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone));
});
