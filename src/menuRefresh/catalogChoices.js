// Retired dishes remain in the catalog so existing saved and unsaved rows retain
// their names and guidance. Only current dishes are offered as new choices.
export function getActiveMenuCatalog(catalog = []) {
  return catalog.filter((item) => item.active !== false);
}

export function getRowMenuOptions(eligibleItems, currentItem, filter = {}, selectedIds = new Set()) {
  const activeItems = getActiveMenuCatalog(eligibleItems);
  const categories = [...new Set(activeItems.map((item) => item.category).filter(Boolean))];
  const categoryItems = activeItems.filter((item) => item.category === filter.category);
  const subcategories = [...new Set(categoryItems.map((item) => item.subcategory).filter(Boolean))];
  const foodOptions = categoryItems.filter((item) => item.subcategory === filter.subcategory
    && (item.id === currentItem?.id || !selectedIds.has(item.id)));
  const retiredItem = currentItem?.active === false ? currentItem : null;
  return {
    categories, subcategories, foodOptions, retiredItem,
    legacyCategory: Boolean(retiredItem && filter.category === retiredItem.category && !categories.includes(filter.category)),
    legacySubcategory: Boolean(retiredItem && filter.category === retiredItem.category
      && filter.subcategory === retiredItem.subcategory && !subcategories.includes(filter.subcategory)),
  };
}
