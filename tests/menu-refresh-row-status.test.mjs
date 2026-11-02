import test from "node:test";
import assert from "node:assert/strict";
import { getMenuRowStatus } from "../src/menuRefresh/rowStatus.js";

const empty = () => ({ currentItemId: "", newFoodName: "" });
const filters = { category: "Vorspeise", subcategory: "Suppe" };
const selected = () => ({ currentItemId: "pumpkin-soup", newFoodName: "" });
const completed = () => ({ currentItemId: "pumpkin-soup", newFoodName: "Tomato Soup" });
const status = (row, filter = {}, savedRow = empty()) => getMenuRowStatus(row, filter, savedRow);

test("an empty row stays Not started, including missing optional values and whitespace-only input", () => {
  for (const row of [undefined, null, {}, empty(), { currentItemId: null, newFoodName: "   " }]) {
    assert.deepEqual(status(row), { key: "not-started", label: "Not started" });
  }
});

test("cascading category, subcategory, and selected-food drafts are In progress", () => {
  for (const [row, filter] of [
    [empty(), { category: "Vorspeise", subcategory: "" }],
    [empty(), filters],
    [empty(), { subcategory: "Suppe" }],
    [selected(), filters],
    [{ currentItemId: "", newFoodName: "Tomato Soup" }, {}],
    [{ currentItemId: "pumpkin-soup", newFoodName: " \t " }, filters],
  ]) assert.deepEqual(status(row, filter), { key: "in-progress", label: "In progress" });
});

test("a replacement becomes Done only after the saved snapshot confirms it, including reload", () => {
  const draft = completed();
  assert.deepEqual(status(draft, filters), { key: "ready", label: "Ready to save" });
  const saved = structuredClone(draft);
  assert.deepEqual(status(draft, filters, saved), { key: "done", label: "Done" });
  const reloaded = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(status(reloaded, filters, saved), { key: "done", label: "Done" });
});

test("editing or clearing a saved completed row shows Unsaved changes until saved again", () => {
  const saved = completed();
  const drafts = [
    { ...saved, newFoodName: "Carrot Soup" },
    { ...saved, currentItemId: "dal-soup" },
    { ...saved, newFoodName: "" },
    { currentItemId: "", newFoodName: saved.newFoodName },
    empty(), // Category/subcategory changes clear the dependent food and replacement.
  ];
  for (const draft of drafts) {
    assert.deepEqual(status(draft, filters, saved), { key: "unsaved", label: "Unsaved changes" });
  }
  const edited = drafts[0];
  assert.equal(status(edited, filters, structuredClone(edited)).key, "done");
  const clearedSaved = empty();
  assert.equal(status(clearedSaved, {}, clearedSaved).key, "not-started");
  assert.equal(status(clearedSaved, filters, clearedSaved).key, "in-progress");
});

test("saved incomplete drafts remain In progress, and finishing them still requires saving", () => {
  const saved = selected();
  assert.deepEqual(status(structuredClone(saved), filters, saved), { key: "in-progress", label: "In progress" });
  assert.equal(status(completed(), filters, saved).key, "ready");
  assert.equal(status(empty(), {}, saved).key, "not-started");
});

test("whitespace edits stay unsaved consistently with raw row dirty tracking", () => {
  const saved = completed();
  const padded = { ...saved, newFoodName: `  ${saved.newFoodName}  ` };
  assert.equal(status(padded, filters, saved).key, "unsaved");
  assert.equal(status(padded, filters).key, "ready");
  const serverNormalized = { ...padded, newFoodName: padded.newFoodName.trim() };
  assert.equal(status(serverNormalized, filters, serverNormalized).key, "done");
});

test("reverting a completed edit restores Done without mutating draft, filter, or saved records", () => {
  const saved = Object.freeze(completed());
  const draft = Object.freeze({ ...saved, newFoodName: "Carrot Soup" });
  const filter = Object.freeze({ ...filters });
  assert.equal(status(draft, filter, saved).key, "unsaved");
  assert.equal(status({ ...draft, newFoodName: saved.newFoodName }, filter, saved).key, "done");
  assert.deepEqual(draft, { currentItemId: "pumpkin-soup", newFoodName: "Carrot Soup" });
  assert.deepEqual(saved, completed());
  assert.deepEqual(filter, filters);
});
