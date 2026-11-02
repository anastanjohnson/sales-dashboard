// Recurring special-menu months follow the restaurant's planning calendar.
// They intentionally do not depend on the date of the holiday in a given year.
const SPECIAL_MENUS = {
  "12": { title: "Christmas & New Year Special Menu", shortLabel: "Christmas & New Year" },
  "01": { title: "Pongal Special Menu", shortLabel: "Pongal" },
  "02": { title: "Valentine Special Menu", shortLabel: "Valentine" },
  "03": { title: "Easter Special Menu", shortLabel: "Easter" },
};

export function getSpecialMenu(month) {
  const match = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.exec(month);
  const special = match && SPECIAL_MENUS[match[1]];
  return special ? { ...special } : null;
}
