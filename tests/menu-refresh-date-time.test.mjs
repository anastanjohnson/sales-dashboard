import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  formatBerlinDateTimeInput, parseBerlinDateTimeInput, getCountdownParts,
} from "../src/menuRefresh/dateTime.js";

test("Berlin wall times save the correct winter/summer UTC instant and cross year boundaries", () => {
  for (const [input, instant] of [
    ["2026-11-02T10:15", "2026-11-02T09:15:00.000Z"],
    ["2027-06-15T10:15", "2027-06-15T08:15:00.000Z"],
    ["2027-01-01T00:15", "2026-12-31T23:15:00.000Z"],
    ["2028-02-29T12:00", "2028-02-29T11:00:00.000Z"],
  ]) {
    assert.equal(parseBerlinDateTimeInput(input), instant);
    assert.equal(formatBerlinDateTimeInput(instant), input);
  }
});

test("spring DST rejects skipped Berlin minutes while accepting both neighboring times", () => {
  for (const date of ["2026-03-29", "2027-03-28"]) {
    for (const time of ["02:00", "02:30", "02:59"]) {
      assert.throws(() => parseBerlinDateTimeInput(`${date}T${time}`), /does not exist.*clocks change/);
    }
    assert.equal(parseBerlinDateTimeInput(`${date}T01:59`), `${date}T00:59:00.000Z`);
    assert.equal(parseBerlinDateTimeInput(`${date}T03:00`), `${date}T01:00:00.000Z`);
  }
});

test("autumn DST consistently chooses the earlier repeated Berlin time", () => {
  for (const date of ["2026-10-25", "2027-10-31"]) {
    assert.equal(parseBerlinDateTimeInput(`${date}T02:30`), `${date}T00:30:00.000Z`);
    assert.equal(formatBerlinDateTimeInput(`${date}T00:30:00.000Z`), `${date}T02:30`);
    assert.equal(formatBerlinDateTimeInput(`${date}T01:30:00.000Z`), `${date}T02:30`);
    assert.equal(parseBerlinDateTimeInput(`${date}T03:00`), `${date}T02:00:00.000Z`);
  }
});

test("invalid calendar/input values are rejected, while clearing the input is nullable", () => {
  for (const value of ["2027-02-29T12:00", "2026-04-31T12:00", "2026-00-10T12:00",
    "2026-13-01T12:00", "2026-11-02T24:00", "2026-11-02T12:60", "2026-11-02T12:00Z",
    "2026-11-02T12:00:00", "2026-1-02T12:00", "1999-12-31T12:00", "2101-01-01T12:00", " ", 42]) {
    assert.throws(() => parseBerlinDateTimeInput(value), /valid/);
  }
  for (const value of ["", null, undefined]) assert.equal(parseBerlinDateTimeInput(value), null);
  for (const value of [null, undefined, "invalid", "2026-11-02T12:00"]) {
    assert.equal(formatBerlinDateTimeInput(value), "");
    assert.equal(getCountdownParts(value), null);
  }
});

test("conversion is independent of the browser/device timezone", () => {
  const moduleUrl = new URL("../src/menuRefresh/dateTime.js", import.meta.url).href;
  const source = `import {parseBerlinDateTimeInput,formatBerlinDateTimeInput} from ${JSON.stringify(moduleUrl)};
    process.stdout.write(JSON.stringify([parseBerlinDateTimeInput("2027-06-15T10:15"),formatBerlinDateTimeInput("2027-06-15T08:15:00.000Z")]));`;
  for (const timeZone of ["UTC", "Pacific/Honolulu", "Asia/Kolkata"]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
      encoding: "utf8", env: { ...process.env, TZ: timeZone },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ["2027-06-15T08:15:00.000Z", "2027-06-15T10:15"]);
  }
});

test("countdown decomposes real elapsed seconds and never becomes available early", () => {
  const now = Date.parse("2026-11-02T09:00:00.000Z");
  const target = new Date(now + 90061000).toISOString();
  assert.deepEqual(getCountdownParts(target, now), {
    totalSeconds: 90061, days: 1, hours: 1, minutes: 1, seconds: 1, isAvailable: false,
  });
  assert.equal(getCountdownParts(new Date(now + 1).toISOString(), now).totalSeconds, 1);
  assert.equal(getCountdownParts(new Date(now + 1).toISOString(), now).isAvailable, false);
  assert.equal(getCountdownParts(new Date(now + 1001).toISOString(), now).totalSeconds, 2);
  const zero = { totalSeconds: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isAvailable: true };
  assert.deepEqual(getCountdownParts(new Date(now).toISOString(), now), zero);
  assert.deepEqual(getCountdownParts(new Date(now - 1).toISOString(), now), zero);
  assert.equal(getCountdownParts(target, NaN), null);
});

test("countdown spans Berlin DST changes as actual 23-hour and 25-hour days", () => {
  const spring = getCountdownParts(parseBerlinDateTimeInput("2027-03-28T12:00"),
    Date.parse(parseBerlinDateTimeInput("2027-03-27T12:00")));
  assert.deepEqual([spring.days, spring.hours, spring.minutes, spring.seconds], [0, 23, 0, 0]);
  const autumn = getCountdownParts(parseBerlinDateTimeInput("2027-10-31T12:00"),
    Date.parse(parseBerlinDateTimeInput("2027-10-30T12:00")));
  assert.deepEqual([autumn.days, autumn.hours, autumn.minutes, autumn.seconds], [1, 1, 0, 0]);
});
