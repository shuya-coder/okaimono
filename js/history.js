window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.PurchasedManager = class PurchasedManager {
  constructor(storage, categoryManager) {
    this.storage = storage;
    this.categoryManager = categoryManager;
    this.storageKey = "purchasedItems";
    this.legacyStorageKey = "shoppingHistory";
  }

  getAll() {
    const savedItems = this.storage.get(this.storageKey, null);
    if (Array.isArray(savedItems)) return this.normalizeItems(savedItems);

    const legacyRecords = this.storage
      .get(this.legacyStorageKey, [])
      .filter((record) => (record.action || "added") === "purchased")
      .map((record) => ({
        ...record,
        lastPurchasedAt: record.lastPurchasedAt || record.date || record.createdAt,
        purchaseCount: 1,
      }));
    const migratedItems = this.mergeDuplicates(this.normalizeItems(legacyRecords));
    this.save(migratedItems);
    return migratedItems;
  }

  normalizeItems(items) {
    const categories = this.categoryManager.getAll();
    return items
      .filter((item) => String(item.name || "").trim())
      .map((item) => {
        const category =
          categories.find((current) => current.id === Number(item.categoryId)) ||
          categories.find((current) => current.name === item.category || current.name === item.categoryName) ||
          this.categoryManager.getFallback();

        return {
          id: Number(item.id) || this.createId(),
          name: String(item.name).trim(),
          categoryId: category.id,
          lastPurchasedAt: item.lastPurchasedAt || item.date || item.createdAt || new Date().toISOString(),
          purchaseCount: Math.max(1, Number(item.purchaseCount) || 1),
        };
      });
  }

  mergeDuplicates(items) {
    const merged = new Map();
    [...items]
      .sort((a, b) => new Date(b.lastPurchasedAt) - new Date(a.lastPurchasedAt))
      .forEach((item) => {
        const key = item.name.toLocaleLowerCase("ja-JP");
        const existing = merged.get(key);
        if (existing) {
          existing.purchaseCount += item.purchaseCount;
        } else {
          merged.set(key, { ...item });
        }
      });
    return [...merged.values()];
  }

  save(items) {
    this.storage.set(this.storageKey, items);
  }

  recordPurchase(item) {
    if (!item) return null;
    const items = this.getAll();
    const key = item.name.trim().toLocaleLowerCase("ja-JP");
    const existing = items.find((current) => current.name.toLocaleLowerCase("ja-JP") === key);
    const purchasedItem = {
      id: existing?.id || this.createId(),
      name: item.name.trim(),
      categoryId: Number(item.categoryId),
      lastPurchasedAt: new Date().toISOString(),
      purchaseCount: (existing?.purchaseCount || 0) + 1,
    };
    this.save([purchasedItem, ...items.filter((current) => current.id !== existing?.id)]);
    return purchasedItem;
  }

  delete(id) {
    this.save(this.getAll().filter((item) => item.id !== id));
  }

  replaceCategory(oldCategoryId, newCategoryId) {
    this.save(
      this.getAll().map((item) =>
        item.categoryId === oldCategoryId ? { ...item, categoryId: newCategoryId } : item
      )
    );
  }

  createId() {
    return Date.now() + Math.floor(Math.random() * 100000);
  }
};
