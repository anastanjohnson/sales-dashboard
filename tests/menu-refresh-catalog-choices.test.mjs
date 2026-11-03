import test from "node:test";
import assert from "node:assert/strict";
import { getActiveMenuCatalog, getRowMenuOptions } from "../src/menuRefresh/catalogChoices.js";

const current = { id: "rice", name: "Rice", category: "Main", subcategory: "Rice" };
const other = { id: "other-rice", name: "Other rice", category: "Main", subcategory: "Rice", active: true };
const retired = { id: "old-sweet", name: "Old sweet", category: "Dessert", subcategory: "Highlights", active: false };
const catalog = [current, other, retired];

test("new choices exclude retired dishes without modifying catalog or configured IDs", () => {
  const allowed = ["rice", "old-sweet"];
  const before = JSON.stringify({ catalog, allowed });
  const active = getActiveMenuCatalog(catalog);
  assert.deepEqual(active.map((item) => item.id), ["rice", "other-rice"]);
  assert.deepEqual(active.filter((item) => new Set(allowed).has(item.id)).map((item) => item.id), ["rice"]);
  assert.equal(JSON.stringify({ catalog, allowed }), before);
});

test("an existing retired selection is retained only for its own row", () => {
  const legacy = getRowMenuOptions(catalog, retired, { category: "Dessert", subcategory: "Highlights" });
  assert.equal(legacy.retiredItem, retired);
  assert.equal(legacy.legacyCategory, true);
  assert.equal(legacy.legacySubcategory, true);
  assert.deepEqual(legacy.foodOptions, []);
  const emptyRow = getRowMenuOptions(catalog, null, { category: "Dessert", subcategory: "Highlights" });
  assert.equal(emptyRow.retiredItem, null);
  assert.equal(emptyRow.legacyCategory, false);
  assert.equal(emptyRow.legacySubcategory, false);
  assert.deepEqual(emptyRow.categories, ["Main"]);
  assert.deepEqual(emptyRow.foodOptions, []);
});

test("retired subcategories do not leak into an otherwise current category", () => {
  const archive = { ...retired, category: "Main" };
  const options = getRowMenuOptions([current, archive], archive, { category: "Main", subcategory: "Highlights" });
  assert.deepEqual(options.categories, ["Main"]);
  assert.deepEqual(options.subcategories, ["Rice"]);
  assert.equal(options.legacyCategory, false);
  assert.equal(options.legacySubcategory, true);
});

test("other rows cannot duplicate a current selection, while its own row retains it", () => {
  const selected = new Set([current.id]);
  const filter = { category: "Main", subcategory: "Rice" };
  assert.deepEqual(getRowMenuOptions(catalog, null, filter, selected).foodOptions.map((item) => item.id), [other.id]);
  assert.deepEqual(getRowMenuOptions(catalog, current, filter, selected).foodOptions.map((item) => item.id), [current.id, other.id]);
});

test("a dish moved to a normal subcategory keeps its stable selection and replacement", () => {
  const moved = { ...current, subcategory: "Curries" };
  const row = { currentItemId: current.id, newFoodName: "Saved replacement" };
  const before = JSON.stringify(row);
  const options = getRowMenuOptions([moved, retired], moved, { category: "Main", subcategory: "Curries" }, new Set([current.id]));
  assert.deepEqual(options.subcategories, ["Curries"]);
  assert.equal(options.foodOptions[0].id, row.currentItemId);
  assert.equal(options.retiredItem, null);
  assert.equal(JSON.stringify(row), before);
});
