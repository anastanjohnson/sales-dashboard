// Shared by the cookie-based Node server and the authenticated Supabase API.
// The existing salary-payment account is Anastan; the admin account fulfils rotations.
const OWNER_ROLE = "salary-payment";
const ACCESS_ROLES = new Set([OWNER_ROLE, "admin"]);
const EMPTY_ROW = () => ({ currentItemId: "", newFoodName: "" });

export class MenuRotationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new MenuRotationError(message, status); };
export function validateMonth(value) {
  if (typeof value !== "string" || !/^(?:20\d\d|2100)-(?:0[1-9]|1[0-2])$/.test(value)) fail("Choose a valid month between 2000 and 2100.");
  return value;
}
function validateVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail("A valid saved version is required. Refresh this month and try again.");
  return value;
}
function bodyShape(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Invalid menu rotation request.");
  if (Object.keys(body).some(key => !allowed.includes(key))) fail("This request contains fields that cannot be changed here.");
}
function storedRows(state) { return Array.isArray(state.rows) ? state.rows : []; }
export function activeRows(state) {
  return Array.from({ length: state.targetCount }, (_, index) => ({ ...EMPTY_ROW(), ...storedRows(state)[index] }));
}
export function defaultRotation(month) {
  return { month, targetCount: 0, allowedItemIds: [], rows: [], version: 0, configured: false, updatedAt: null };
}
export function deserializeRotation(row, month) {
  if (!row) return defaultRotation(month);
  return { month: row.month, targetCount: row.target_count, allowedItemIds: row.allowed_item_ids,
    rows: row.rows, version: row.version, configured: true, updatedAt: row.updated_at };
}
export function rotationResponse(state, role, catalog) {
  const canConfigure = role === OWNER_ROLE;
  const allowed = new Set(state.allowedItemIds);
  return { ...state, rows: activeRows(state), canConfigure,
    catalog: canConfigure ? catalog : catalog.filter(item => allowed.has(item.id)) };
}
export function configureRotation(state, body, catalog, role) {
  if (role !== OWNER_ROLE) fail("Only Anastan can configure the monthly rotation.", 403);
  bodyShape(body, ["month", "targetCount", "allowedItemIds", "version"]);
  validateMonth(body.month); validateVersion(body.version);
  if (body.month !== state.month) fail("The selected month does not match this rotation.");
  if (body.version !== state.version) fail("This month changed in another login. Refresh before saving.", 409);
  if (!Number.isInteger(body.targetCount) || body.targetCount < 0 || body.targetCount > catalog.length) fail(`Items to change must be a whole number from 0 to ${catalog.length}.`);
  if (!Array.isArray(body.allowedItemIds)) fail("Choose the dishes that the chef may change.");
  const known = new Set(catalog.map(item => item.id));
  if (body.allowedItemIds.some(id => typeof id !== "string" || !known.has(id)) || new Set(body.allowedItemIds).size !== body.allowedItemIds.length) fail("Available dishes must be unique items from the AYCE menu.");
  if (body.targetCount > body.allowedItemIds.length) fail("Enable at least as many dishes as the number of items to change.");
  const allowed = new Set(body.allowedItemIds);
  const nextRows = storedRows(state).map(row => ({ ...EMPTY_ROW(), ...row }));
  while (nextRows.length < body.targetCount) nextRows.push(EMPTY_ROW());
  const removedSelection = nextRows.slice(0, body.targetCount).find(row => row.currentItemId && !allowed.has(row.currentItemId));
  if (removedSelection) fail("A selected dish cannot be removed from the available list. Keep it enabled or clear its rotation row first.");
  const activeIds = nextRows.slice(0, body.targetCount).map(row => row.currentItemId).filter(Boolean);
  if (new Set(activeIds).size !== activeIds.length) fail("Restoring these rows would select the same dish twice. Clear or change the active selection before increasing the target.");
  return { ...state, targetCount: body.targetCount, allowedItemIds: [...body.allowedItemIds], rows: nextRows,
    version: state.version + 1, configured: true };
}
export function saveRotationRows(state, body, role) {
  if (!ACCESS_ROLES.has(role)) fail("Menu rotation access is required.", 403);
  bodyShape(body, ["month", "version", "rows"]);
  validateMonth(body.month); validateVersion(body.version);
  if (body.month !== state.month) fail("The selected month does not match this rotation.");
  if (!state.configured) fail("Anastan must configure this month before changes can be saved.", 409);
  if (body.version !== state.version) fail("This month changed in another login. Refresh before saving.", 409);
  if (!Array.isArray(body.rows) || body.rows.length !== state.targetCount) fail(`This month requires exactly ${state.targetCount} rows.`);
  const allowed = new Set(state.allowedItemIds), selected = new Set();
  const rows = body.rows.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => !["currentItemId", "newFoodName"].includes(key))) fail("Invalid menu rotation row.");
    const id = row.currentItemId ?? "";
    if (typeof id !== "string" || (id && !allowed.has(id))) fail("Choose a current dish from the list enabled by Anastan.");
    if (id && selected.has(id)) fail("Each current dish can only be selected once in a month.");
    if (id) selected.add(id);
    if (typeof row.newFoodName !== "string") fail("Enter a valid new food name.");
    const name = row.newFoodName.trim();
    if (name.length > 160 || /[\u0000-\u001f\u007f]/.test(name)) fail("New food names must contain at most 160 printable characters.");
    if (name && !id) fail("Select the current dish before entering its replacement.");
    return { currentItemId: id, newFoodName: name };
  });
  // A smaller target never deletes work saved for inactive rows.
  return { ...state, rows: [...rows, ...storedRows(state).slice(state.targetCount)], version: state.version + 1 };
}

export function installMenuRotationRoutes(app, { database, tableName, requireAuth, requireSameOrigin, writeLimiter, catalog }) {
  if (!["public.menu_rotation_months", "dashboard_private.menu_rotation_months"].includes(tableName)) throw new Error("Invalid menu rotation table");
  const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(error => {
    if (error instanceof MenuRotationError) return res.status(error.status).json({ error: error.message });
    next(error);
  });
  const requireAccess = (req, res, next) => ACCESS_ROLES.has(req.session?.role) ? next() : res.status(403).json({ error: "Menu rotation access is required." });
  const requireOwner = (req, res, next) => req.session?.role === OWNER_ROLE ? next() : res.status(403).json({ error: "Only Anastan can configure the monthly rotation." });
  const read = async month => {
    const result = await database.query(`SELECT month, target_count, allowed_item_ids, rows, version, updated_at FROM ${tableName} WHERE month = $1`, [month]);
    return deserializeRotation(result.rows[0], month);
  };
  const persist = async (state, expectedVersion) => {
    const values = [state.month, state.targetCount, JSON.stringify(state.allowedItemIds), JSON.stringify(state.rows), state.version, expectedVersion];
    const result = await database.query(`INSERT INTO ${tableName} AS saved (month, target_count, allowed_item_ids, rows, version, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, now())
      ON CONFLICT (month) DO UPDATE SET target_count = EXCLUDED.target_count, allowed_item_ids = EXCLUDED.allowed_item_ids,
        rows = EXCLUDED.rows, version = EXCLUDED.version, updated_at = now()
      WHERE saved.version = $6
      RETURNING month, target_count, allowed_item_ids, rows, version, updated_at`, values);
    if (result.rows.length !== 1) fail("This month changed in another login. Refresh before saving.", 409);
    return deserializeRotation(result.rows[0], state.month);
  };
  app.get("/api/menu-refresh", requireAuth, requireAccess, asyncRoute(async (req, res) => {
    const month = validateMonth(req.query.month);
    res.set("Cache-Control", "no-store").json(rotationResponse(await read(month), req.session.role, catalog));
  }));
  app.put("/api/menu-refresh/config", requireAuth, requireOwner, requireSameOrigin, writeLimiter, asyncRoute(async (req, res) => {
    const month = validateMonth(req.body?.month);
    const state = await read(month);
    const next = configureRotation(state, req.body, catalog, req.session.role);
    res.set("Cache-Control", "no-store").json(rotationResponse(await persist(next, state.version), req.session.role, catalog));
  }));
  app.put("/api/menu-refresh/rows", requireAuth, requireAccess, requireSameOrigin, writeLimiter, asyncRoute(async (req, res) => {
    const month = validateMonth(req.body?.month);
    const state = await read(month);
    const next = saveRotationRows(state, req.body, req.session.role);
    res.set("Cache-Control", "no-store").json(rotationResponse(await persist(next, state.version), req.session.role, catalog));
  }));
}
