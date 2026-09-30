import crypto from "node:crypto";

const monthKey = (row) => `${Number(row.year)}-${String(row.month || "").slice(0, 3).toLowerCase()}`;
const nameKey = (row) => String(row.name || "").trim().toLowerCase();
const cents = (value) => Math.round(Number(value) * 100);
const canonical = (employees) => JSON.stringify((employees || []).map((row) => [nameKey(row), cents(row.workingHours)]).sort((a, b) => a[0].localeCompare(b[0])));
const digest = (employees) => crypto.createHash("sha256").update(canonical(employees)).digest("hex");
const total = (employees) => (employees || []).reduce((sum, row) => sum + cents(row.workingHours), 0) / 100;
const validEmployees = (employees) => Array.isArray(employees) && employees.length > 0
  && employees.every((row) => nameKey(row) && Number.isFinite(row.workingHours) && row.workingHours >= 0)
  && new Set(employees.map(nameKey)).size === employees.length;

// Compare-and-swap prevents a source refresh from replacing independent manual changes.
// Employee records and unrelated periods remain intact; private payloads stay in protected configuration.
export function applyVerifiedStaffHoursRefresh(periods, patches, exclusions = []) {
  const result = [...periods];
  const audits = [];
  for (const patch of patches) {
    const index = result.findIndex((period) => monthKey(period) === monthKey(patch));
    const current = result[index];
    let status = "blocked-destination-changed";
    const excluded = new Set(exclusions.filter((rule) => monthKey(rule) === monthKey(patch))
      .flatMap((rule) => rule.names || []).map((name) => String(name).trim().toLowerCase()));
    const expectedDigest = patch.expectedDigest || (validEmployees(patch.expectedEmployees) ? digest(patch.expectedEmployees) : null);
    const valid = validEmployees(patch.employees) && /^[a-f0-9]{64}$/.test(expectedDigest || "")
      && /^\d{4}-\d{2}-\d{2}$/.test(patch.asOf || "");
    if (!valid) status = "blocked-invalid-patch";
    else if (patch.employees.some((row) => excluded.has(nameKey(row)))) status = "blocked-exclusion";
    else if (current && canonical(patch.employees.map((row) => ({ ...row, workingHours: 0 }))) === canonical((current.employees || []).map((row) => ({ ...row, workingHours: 0 })))
      && (!current.asOf || current.asOf <= patch.asOf)
      && (digest(current.employees) === expectedDigest || canonical(current.employees) === canonical(patch.employees))) {
      const source = new Map(patch.employees.map((row) => [nameKey(row), row]));
      result[index] = {
        ...current,
        asOf: patch.asOf,
        partial: patch.partial,
        source: patch.source,
        employees: current.employees.map((row) => ({
          ...row,
          workingHours: source.get(nameKey(row)).workingHours,
          // Explicit provenance for this source import; do not replace unrelated manual fields.
          sourceDailyHours: source.get(nameKey(row)).dailyHours || [],
        })),
      };
      status = "applied";
    }
    const final = result[index];
    audits.push({
      period: monthKey(patch), status,
      previousAsOf: current?.asOf ?? null,
      previousTotalHours: total(current?.employees),
      expectedTotalHours: patch.expectedEmployees ? total(patch.expectedEmployees) : null,
      expectedDestinationDigest: expectedDigest,
      previousDestinationDigest: digest(current?.employees),
      sourceTotalHours: total(patch.employees),
      totalHours: total(final?.employees), asOf: final?.asOf ?? null,
      employeeCount: final?.employees?.length ?? 0,
      sourceDigest: digest(patch.employees), destinationDigest: digest(final?.employees),
    });
  }
  return { periods: result, audits };
}

export function summarizeStaffHours(period) {
  return {
    period: monthKey(period), asOf: period.asOf ?? null,
    totalHours: total(period.employees), employeeCount: period.employees?.length ?? 0,
    destinationDigest: digest(period.employees),
  };
}
