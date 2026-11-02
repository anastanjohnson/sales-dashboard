import test from "node:test";
import assert from "node:assert/strict";
import {
  MenuRotationError, activeRows, configureRotation, defaultRotation,
  installMenuRotationRoutes, rotationResponse, saveRotationRows, validateAvailableAt, validateMonth,
} from "../supabase/functions/dashboard-api/menu-rotation.js";
import { getSpecialMenu } from "../supabase/functions/dashboard-api/menu-calendar.js";

const catalog = [{ id: "one", name: "First dish" }, { id: "two", name: "Second dish" }, { id: "three", name: "Third dish" }];
const month = "2026-11";
const owner = "salary-payment", chef = "admin";
const setup = (targetCount = 2) => configureRotation(defaultRotation(month), {
  month, version: 0, targetCount, allowedItemIds: catalog.map(item => item.id),
}, catalog, owner);
const errorWith = (status, pattern) => error => error instanceof MenuRotationError && error.status === status && pattern.test(error.message);

const specialMenus = [
  ["12", "Christmas & New Year Special Menu", "Christmas & New Year"],
  ["01", "Pongal Special Menu", "Pongal"],
  ["02", "Valentine Special Menu", "Valentine"],
  ["03", "Easter Special Menu", "Easter"],
];
test("the restaurant's four special-menu months recur every year", () => {
  for (const year of [2026, 2027, 2030]) for (const [number, title, shortLabel] of specialMenus) {
    assert.deepEqual(getSpecialMenu(`${year}-${number}`), { title, shortLabel });
  }
  for (const value of ["2026-04", "2026-11", "2027-04", "2027-11", "2026-00", undefined]) assert.equal(getSpecialMenu(value), null);
});
test("special-menu responses pause rotation without changing stored settings", () => {
  for (const [number, title] of specialMenus) for (const role of [owner, chef]) {
    const state = { ...setup(), month: `2027-${number}`, rows: [{ currentItemId: "one", newFoodName: "Saved replacement" }, { currentItemId: "two", newFoodName: "Another saved replacement" }] };
    const before = structuredClone(state);
    const response = rotationResponse(state, role, catalog);
    assert.equal(response.specialMenu.title, title);
    assert.equal(response.rotationEnabled, false);
    assert.equal(response.targetCount, 0);
    assert.deepEqual(response.rows, []);
    assert.deepEqual(response.allowedItemIds, []);
    assert.deepEqual(response.catalog, []);
    assert.equal(response.canConfigure, role === owner);
    assert.deepEqual(state, before);
  }
  for (const value of ["2026-04", "2026-11"]) {
    const response = rotationResponse({ ...setup(), month: value }, owner, catalog);
    assert.equal(response.rotationEnabled, true); assert.equal(response.specialMenu, null);
    assert.equal(response.targetCount, 2); assert.equal(response.rows.length, 2); assert.equal(response.catalog.length, 3);
  }
});
test("pure configuration and row saves reject recurring special-menu months", () => {
  for (const [number, title] of specialMenus) {
    const specialMonth = `2027-${number}`, state = { ...setup(), month: specialMonth };
    const expected = error => error instanceof MenuRotationError && error.status === 403 && error.message === `${title} is scheduled for this month. Regular menu rotation is paused.`;
    assert.throws(() => configureRotation(state, { month: specialMonth, version: 1, targetCount: 1, allowedItemIds: ["one"] }, catalog, owner), expected);
    for (const role of [owner, chef]) assert.throws(() => saveRotationRows(state, { month: specialMonth, version: 1, rows: activeRows(state) }, role), expected);
  }
});

test("months are isolated and calendar values are validated", () => {
  for (const value of ["2026-11", "2000-01", "2100-12"]) assert.equal(validateMonth(value), value);
  for (const value of ["2026-00", "2026-13", "1999-11", "2101-01", "2026-1", undefined, [month]]) assert.throws(() => validateMonth(value), MenuRotationError);
  assert.deepEqual(activeRows(defaultRotation(month)), []);
});
test("Menu Available accepts explicit ISO instants and normalizes them to UTC", () => {
  assert.equal(validateAvailableAt(null), null);
  assert.equal(validateAvailableAt("2026-11-10T15:30:00+01:00"), "2026-11-10T14:30:00.000Z");
  assert.equal(validateAvailableAt("2027-07-10T15:30:00+02:00"), "2027-07-10T13:30:00.000Z");
  assert.equal(validateAvailableAt("2028-02-29T12:00:00.125Z"), "2028-02-29T12:00:00.125Z");
  assert.equal(validateAvailableAt("0001-01-01T00:00:00Z"), "0001-01-01T00:00:00.000Z");
  assert.equal(validateAvailableAt("9999-12-31T23:59:59Z"), "9999-12-31T23:59:59.000Z");
  for (const value of [undefined, "", 1794234600000, "2026-11-10", "2026-11-10T15:30:00", "2026-02-29T12:00:00Z", "2026-04-31T12:00:00Z", "2026-11-10T24:00:00Z", "2026-11-10T15:60:00Z", "2026-11-10T15:30:00+24:00", "0000-01-01T00:00:00Z", "0001-01-01T00:00:00+01:00", "9999-12-31T23:59:59-01:00", "tomorrow"]) {
    assert.throws(() => validateAvailableAt(value), errorWith(400, /Menu Available/));
  }
});
test("availability is owner-controlled, optional for older clients and preserved by row saves", () => {
  let state = configureRotation(defaultRotation(month), { month, version: 0, targetCount: 1, allowedItemIds: ["one"], availableAt: "2026-11-10T15:30:00+01:00" }, catalog, owner);
  assert.equal(state.availableAt, "2026-11-10T14:30:00.000Z");
  assert.equal(rotationResponse(state, chef, catalog).availableAt, state.availableAt);
  state = configureRotation(state, { month, version: 1, targetCount: 1, allowedItemIds: ["one"] }, catalog, owner);
  assert.equal(state.availableAt, "2026-11-10T14:30:00.000Z");
  state = saveRotationRows(state, { month, version: 2, rows: [{ currentItemId: "one", newFoodName: "Replacement" }] }, chef);
  assert.equal(state.availableAt, "2026-11-10T14:30:00.000Z");
  assert.throws(() => saveRotationRows(state, { month, version: 3, availableAt: null, rows: activeRows(state) }, chef), MenuRotationError);
  state = configureRotation(state, { month, version: 3, targetCount: 1, allowedItemIds: ["one"], availableAt: null }, catalog, owner);
  assert.equal(state.availableAt, null);
});
test("only Anastan can set the monthly count or dish pool", () => {
  assert.throws(() => configureRotation(defaultRotation(month), { month, version: 0, targetCount: 1, allowedItemIds: ["one"] }, catalog, chef), errorWith(403, /Only Anastan/));
  const state = setup();
  assert.equal(state.targetCount, 2);
  assert.equal(activeRows(state).length, 2);
  assert.equal(state.version, 1);
});
test("target and allowed dishes must form a valid current menu selection", () => {
  const base = { month, version: 0, targetCount: 2, allowedItemIds: ["one", "two"] };
  for (const patch of [{ targetCount: 1.5 }, { targetCount: -1 }, { targetCount: 4 }, { allowedItemIds: ["one"] }, { allowedItemIds: ["one", "one"] }, { allowedItemIds: ["one", "invented"] }]) {
    assert.throws(() => configureRotation(defaultRotation(month), { ...base, ...patch }, catalog, owner), MenuRotationError);
  }
});
test("Admin only receives enabled dishes and a fixed target", () => {
  const state = configureRotation(defaultRotation(month), { month, version: 0, targetCount: 1, allowedItemIds: ["two"] }, catalog, owner);
  const response = rotationResponse(state, chef, catalog);
  assert.equal(response.canConfigure, false);
  assert.equal(response.targetCount, 1);
  assert.deepEqual(response.catalog, [catalog[1]]);
  assert.equal(rotationResponse(state, owner, catalog).catalog.length, 3);
});
test("chef can save partial drafts but cannot inject a disabled or duplicate dish", () => {
  const state = configureRotation(defaultRotation(month), { month, version: 0, targetCount: 2, allowedItemIds: ["one", "two"] }, catalog, owner);
  const rows = [{ currentItemId: "one", newFoodName: "  Replacement  " }, { currentItemId: "", newFoodName: "" }];
  assert.equal(saveRotationRows(state, { month, version: 1, rows }, chef).rows[0].newFoodName, "Replacement");
  for (const bad of [
    [{ currentItemId: "three", newFoodName: "X" }, rows[1]],
    [rows[0], { currentItemId: "one", newFoodName: "Y" }],
    [{ currentItemId: "", newFoodName: "X" }, rows[1]],
    [rows[0]],
    [{ currentItemId: "one", newFoodName: "X".repeat(161) }, rows[1]],
  ]) assert.throws(() => saveRotationRows(state, { month, version: 1, rows: bad }, chef), MenuRotationError);
  assert.throws(() => saveRotationRows(state, { month, version: 1, rows, targetCount: 9 }, chef), MenuRotationError);
});
test("saved rows survive a lowered target and return when it increases", () => {
  let state = saveRotationRows(setup(), { month, version: 1, rows: [{ currentItemId: "one", newFoodName: "A" }, { currentItemId: "two", newFoodName: "B" }] }, chef);
  state = configureRotation(state, { month, version: 2, targetCount: 1, allowedItemIds: ["one", "two"] }, catalog, owner);
  assert.equal(activeRows(state).length, 1);
  assert.equal(state.rows[1].newFoodName, "B");
  state = saveRotationRows(state, { month, version: 3, rows: [{ currentItemId: "one", newFoodName: "A changed" }] }, chef);
  state = configureRotation(state, { month, version: 4, targetCount: 2, allowedItemIds: ["one", "two"] }, catalog, owner);
  assert.deepEqual(activeRows(state).map(row => row.newFoodName), ["A changed", "B"]);
});
test("configuration cannot silently remove a selected dish", () => {
  const state = saveRotationRows(setup(), { month, version: 1, rows: [{ currentItemId: "one", newFoodName: "A" }, { currentItemId: "", newFoodName: "" }] }, chef);
  assert.throws(() => configureRotation(state, { month, version: 2, targetCount: 1, allowedItemIds: ["two"] }, catalog, owner), errorWith(400, /selected dish/));
});
test("restoring saved inactive rows cannot introduce duplicate active dishes", () => {
  let state = saveRotationRows(setup(), { month, version: 1, rows: [{ currentItemId: "one", newFoodName: "A" }, { currentItemId: "two", newFoodName: "B" }] }, chef);
  state = configureRotation(state, { month, version: 2, targetCount: 1, allowedItemIds: ["one", "two"] }, catalog, owner);
  state = saveRotationRows(state, { month, version: 3, rows: [{ currentItemId: "two", newFoodName: "A changed" }] }, chef);
  assert.throws(() => configureRotation(state, { month, version: 4, targetCount: 2, allowedItemIds: ["one", "two"] }, catalog, owner), errorWith(400, /same dish twice/));
  assert.deepEqual(state.rows.map(row => row.newFoodName), ["A changed", "B"]);
  state = saveRotationRows(state, { month, version: 4, rows: [{ currentItemId: "", newFoodName: "" }] }, chef);
  state = configureRotation(state, { month, version: 5, targetCount: 2, allowedItemIds: ["one", "two"] }, catalog, owner);
  assert.equal(activeRows(state)[1].newFoodName, "B");
});
test("a stale saved version is rejected for config and chef changes", () => {
  const state = setup();
  assert.throws(() => configureRotation(state, { month, version: 0, targetCount: 1, allowedItemIds: ["one"] }, catalog, owner), errorWith(409, /changed/));
  assert.throws(() => saveRotationRows(state, { month, version: 0, rows: activeRows(state) }, chef), errorWith(409, /changed/));
});

function apiHarness() {
  const routes = new Map(), records = new Map(); let readCount = 0, writeCount = 0, conflict = false;
  const app = { get(path, ...handlers) { routes.set(`GET ${path}`, handlers); }, put(path, ...handlers) { routes.set(`PUT ${path}`, handlers); } };
  const database = { async query(sql, values) {
    if (sql.startsWith("SELECT")) { readCount++; return { rows: records.has(values[0]) ? [structuredClone(records.get(values[0]))] : [] }; }
    writeCount++;
    const existing = records.get(values[0]);
    if (conflict) { conflict = false; return { rows: [] }; }
    if (existing && existing.version !== values[5]) return { rows: [] };
    const row = { month: values[0], target_count: values[1], allowed_item_ids: JSON.parse(values[2]), rows: JSON.parse(values[3]), available_at: values[6] ?? null, version: values[4], updated_at: "2026-11-02T12:00:00.000Z" };
    records.set(values[0], row); return { rows: [structuredClone(row)] };
  } };
  const requireAuth = (req, res, next) => req.session ? next() : res.status(401).json({ error: "Authentication required" });
  const requireSameOrigin = (req, res, next) => req.origin === "same" ? next() : res.status(403).json({ error: "Invalid origin" });
  installMenuRotationRoutes(app, { database, tableName: "dashboard_private.menu_rotation_months", requireAuth, requireSameOrigin, writeLimiter: (_req, _res, next) => next(), catalog });
  async function request(method, path, { role, body, origin = "same", query = { month } } = {}) {
    const req = { session: role ? { role } : null, body, query, origin };
    const res = { code: 200, headers: {}, status(code) { this.code = code; return this; }, set(key, value) { this.headers[key] = value; return this; }, json(value) { this.body = value; return this; } };
    for (const handler of routes.get(`${method} ${path}`)) {
      let continued = false, failure;
      await handler(req, res, error => { continued = true; failure = error; });
      if (failure) throw failure;
      if (!continued) break;
    }
    return res;
  }
  return { request, records, counts: () => ({ reads: readCount, writes: writeCount }), conflictNextWrite() { conflict = true; } };
}
test("API blocks anonymous and chef configuration before database access", async () => {
  const api = apiHarness();
  assert.equal((await api.request("GET", "/api/menu-refresh")).code, 401);
  assert.equal((await api.request("PUT", "/api/menu-refresh/config", { role: chef, body: {} })).code, 403);
  assert.equal((await api.request("PUT", "/api/menu-refresh/rows", { role: chef, body: {}, origin: "other" })).code, 403);
  assert.deepEqual(api.counts(), { reads: 0, writes: 0 });
});
test("API shares the configured target with Admin and isolates months", async () => {
  const api = apiHarness();
  const empty = await api.request("GET", "/api/menu-refresh", { role: chef });
  assert.equal(empty.body.configured, false); assert.equal(empty.headers["Cache-Control"], "no-store");
  const saved = await api.request("PUT", "/api/menu-refresh/config", { role: owner, body: { month, version: 0, targetCount: 1, allowedItemIds: ["one", "two"] } });
  assert.equal(saved.code, 200); assert.equal(saved.body.version, 1);
  const read = await api.request("GET", "/api/menu-refresh", { role: chef });
  assert.equal(read.body.targetCount, 1); assert.equal(read.body.catalog.length, 2); assert.equal(read.body.canConfigure, false);
  const other = await api.request("GET", "/api/menu-refresh", { role: chef, query: { month: "2026-12" } });
  assert.equal(other.body.targetCount, 0);
});
test("API persists availability and exposes a read-only value to Admin", async () => {
  const api = apiHarness();
  const settings = { month, version: 0, targetCount: 1, allowedItemIds: ["one"], availableAt: "2026-11-10T15:30:00+01:00" };
  const configured = await api.request("PUT", "/api/menu-refresh/config", { role: owner, body: settings });
  assert.equal(configured.code, 200); assert.equal(configured.body.availableAt, "2026-11-10T14:30:00.000Z");
  assert.equal(api.records.get(month).available_at, configured.body.availableAt);
  const read = await api.request("GET", "/api/menu-refresh", { role: chef });
  assert.equal(read.body.availableAt, configured.body.availableAt); assert.equal(read.body.canConfigure, false);
  const blocked = await api.request("PUT", "/api/menu-refresh/config", { role: chef, body: { ...settings, version: 1, availableAt: null } });
  assert.equal(blocked.code, 403); assert.equal(api.records.get(month).version, 1);
  const rows = [{ currentItemId: "one", newFoodName: "Replacement" }];
  const tampered = await api.request("PUT", "/api/menu-refresh/rows", { role: chef, body: { month, version: 1, rows, availableAt: null } });
  assert.equal(tampered.code, 400); assert.equal(api.records.get(month).version, 1);
  const savedRows = await api.request("PUT", "/api/menu-refresh/rows", { role: chef, body: { month, version: 1, rows } });
  assert.equal(savedRows.code, 200); assert.equal(savedRows.body.availableAt, configured.body.availableAt);
  const oldClient = await api.request("PUT", "/api/menu-refresh/config", { role: owner, body: { month, version: 2, targetCount: 1, allowedItemIds: ["one"] } });
  assert.equal(oldClient.code, 200); assert.equal(oldClient.body.availableAt, configured.body.availableAt);
  const stale = await api.request("PUT", "/api/menu-refresh/config", { role: owner, body: { ...settings, version: 2, availableAt: null } });
  assert.equal(stale.code, 409); assert.equal(api.records.get(month).available_at, configured.body.availableAt);
  const cleared = await api.request("PUT", "/api/menu-refresh/config", { role: owner, body: { ...settings, version: 3, availableAt: null } });
  assert.equal(cleared.code, 200); assert.equal(cleared.body.availableAt, null);
});
test("invalid availability cannot write any configuration", async () => {
  const api = apiHarness();
  for (const availableAt of ["2026-02-30T12:00:00Z", "2026-11-10T14:30", "", 123]) {
    const response = await api.request("PUT", "/api/menu-refresh/config", { role: owner, body: { month, version: 0, targetCount: 1, allowedItemIds: ["one"], availableAt } });
    assert.equal(response.code, 400); assert.match(response.body.error, /Menu Available/);
  }
  assert.equal(api.counts().writes, 0); assert.equal(api.records.size, 0);
});
test("API returns 409 when a second writer wins after the initial read", async () => {
  const api = apiHarness();
  await api.request("PUT", "/api/menu-refresh/config", { role: owner, body: { month, version: 0, targetCount: 1, allowedItemIds: ["one"] } });
  api.conflictNextWrite();
  const result = await api.request("PUT", "/api/menu-refresh/rows", { role: chef, body: { month, version: 1, rows: [{ currentItemId: "one", newFoodName: "New" }] } });
  assert.equal(result.code, 409);
  assert.equal(api.records.get(month).rows[0].newFoodName, "");
});
test("API special-menu writes are blocked before database reads and preserve records", async () => {
  const api = apiHarness();
  for (const [number] of specialMenus) api.records.set(`2027-${number}`, {
    month: `2027-${number}`, target_count: 1, allowed_item_ids: ["one"],
    rows: [{ currentItemId: "one", newFoodName: "Previously saved replacement" }], version: 3, updated_at: "2026-11-02T12:00:00.000Z",
  });
  const before = structuredClone(api.records);
  for (const [number, title] of specialMenus) {
    const specialMonth = `2027-${number}`;
    const config = await api.request("PUT", "/api/menu-refresh/config", { role: owner, body: { month: specialMonth, version: 3, targetCount: 1, allowedItemIds: ["one"] } });
    assert.equal(config.code, 403); assert.match(config.body.error, /Regular menu rotation is paused/);
    for (const role of [owner, chef]) {
      const result = await api.request("PUT", "/api/menu-refresh/rows", { role, body: { month: specialMonth, version: 3, rows: [{ currentItemId: "one", newFoodName: "Changed" }] } });
      assert.equal(result.code, 403); assert.ok(result.body.error.startsWith(title));
    }
  }
  assert.deepEqual(api.counts(), { reads: 0, writes: 0 });
  assert.deepEqual(api.records, before);
  for (const [number, title] of specialMenus) {
    const response = await api.request("GET", "/api/menu-refresh", { role: chef, query: { month: `2027-${number}` } });
    assert.equal(response.code, 200); assert.equal(response.body.specialMenu.title, title);
    assert.equal(response.body.rotationEnabled, false); assert.equal(response.body.targetCount, 0);
    assert.deepEqual(response.body.rows, []); assert.deepEqual(response.body.catalog, []);
  }
  assert.equal(api.counts().writes, 0); assert.deepEqual(api.records, before);
});
