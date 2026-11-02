const STATUSES = Object.freeze(Object.fromEntries([
  ["not-started", "Not started"],
  ["in-progress", "In progress"],
  ["ready", "Ready to save"],
  ["done", "Done"],
  ["unsaved", "Unsaved changes"],
].map(([key, label]) => [key, Object.freeze({ key, label })])));

const text = (value) => typeof value === "string" ? value : "";
const rowValues = (row) => ({ currentItemId: text(row?.currentItemId), newFoodName: text(row?.newFoodName) });
const complete = (row) => Boolean(row.currentItemId.trim() && row.newFoodName.trim());

/** Derive display status without changing a draft or claiming that it was saved. */
export function getMenuRowStatus(row, filter, savedRow) {
  const draft = rowValues(row);
  const saved = rowValues(savedRow);
  const changed = draft.currentItemId !== saved.currentItemId || draft.newFoodName !== saved.newFoodName;

  // Completion requires a persisted replacement. Raw equality matches the page's
  // dirty tracking: even whitespace edits remain unsaved until the server trims them.
  if (complete(saved)) return changed ? STATUSES.unsaved : STATUSES.done;
  if (complete(draft)) return STATUSES.ready;
  if (draft.currentItemId.trim() || draft.newFoodName.trim()
    || text(filter?.category).trim() || text(filter?.subcategory).trim()) {
    return STATUSES["in-progress"];
  }
  return STATUSES["not-started"];
}
