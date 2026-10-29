window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.PurchasedManager = class PurchasedManager {
  constructor(storage, categoryManager) {
    this.storage = storage;
    this.categoryManager = categoryManager;
    this.storageKey = "purchasedItems";
    this.recordsStorageKey = "purchaseRecords";
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
        lastPurchasedAt: record.lastPurchasedAt || record.date || record.createdAt || null,
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
        const purchasedAt = item.lastPurchasedAt || item.date || item.createdAt || null;

        return {
          id: Number(item.id) || this.createId(),
          name: String(item.name).trim(),
          categoryId: category.id,
          lastPurchasedAt: this.isValidDate(purchasedAt) ? purchasedAt : null,
          purchaseCount: Math.max(1, Number(item.purchaseCount) || 1),
        };
      });
  }

  getPurchaseRecords() {
    const records = this.storage.get(this.recordsStorageKey, []);
    const normalized = this.normalizeRecords(Array.isArray(records) ? records : []);
    this.savePurchaseRecords(normalized);
    return normalized.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
  }

  normalizeRecords(records) {
    const categories = this.categoryManager.getAll();
    return records
      .filter((record) => String(record.name || "").trim() && this.isValidDate(record.purchasedAt))
      .map((record) => {
        const category =
          categories.find((current) => current.id === Number(record.categoryId)) ||
          categories.find((current) => current.name === record.category || current.name === record.categoryName) ||
          this.categoryManager.getFallback();
        return {
          id: String(record.id || this.createRecordId()),
          sourceItemId: record.sourceItemId == null ? null : Number(record.sourceItemId),
          name: String(record.name).trim(),
          count: Math.max(1, Number(record.count) || 1),
          categoryId: category.id,
          purchasedAt: new Date(record.purchasedAt).toISOString(),
        };
      });
  }

  mergeDuplicates(items) {
    const merged = new Map();
    [...items]
      .sort((a, b) => this.dateValue(b.lastPurchasedAt) - this.dateValue(a.lastPurchasedAt))
      .forEach((item) => {
        const key = item.name.toLocaleLowerCase("ja-JP");
        const existing = merged.get(key);
        if (existing) {
          existing.purchaseCount += item.purchaseCount;
          if (this.dateValue(item.lastPurchasedAt) > this.dateValue(existing.lastPurchasedAt)) {
            existing.lastPurchasedAt = item.lastPurchasedAt;
            existing.categoryId = item.categoryId;
          }
        } else {
          merged.set(key, { ...item });
        }
      });
    return [...merged.values()];
  }

  save(items) {
    this.storage.set(this.storageKey, items);
  }

  savePurchaseRecords(records) {
    this.storage.set(this.recordsStorageKey, records);
  }

  recordPurchase(item, purchasedAt = new Date().toISOString()) {
    if (!item || !String(item.name || "").trim()) return null;
    const sourceItemId = Number(item.id) || null;
    const records = this.getPurchaseRecords();
    if (sourceItemId && records.some((record) => record.sourceItemId === sourceItemId)) {
      return records.find((record) => record.sourceItemId === sourceItemId);
    }

    const timestamp = this.isValidDate(purchasedAt) ? new Date(purchasedAt).toISOString() : new Date().toISOString();
    const record = {
      id: this.createRecordId(),
      sourceItemId,
      name: String(item.name).trim(),
      count: Math.max(1, Number(item.count) || 1),
      categoryId: Number(item.categoryId),
      purchasedAt: timestamp,
    };
    this.savePurchaseRecords([record, ...records]);

    const items = this.getAll();
    const key = record.name.toLocaleLowerCase("ja-JP");
    const existing = items.find((current) => current.name.toLocaleLowerCase("ja-JP") === key);
    const purchasedItem = {
      id: existing?.id || this.createId(),
      name: record.name,
      categoryId: record.categoryId,
      lastPurchasedAt: timestamp,
      purchaseCount: (existing?.purchaseCount || 0) + 1,
    };
    this.save([purchasedItem, ...items.filter((current) => current.id !== existing?.id)]);
    return record;
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
    this.savePurchaseRecords(
      this.getPurchaseRecords().map((record) =>
        record.categoryId === oldCategoryId ? { ...record, categoryId: newCategoryId } : record
      )
    );
  }

  dateValue(value) {
    return this.isValidDate(value) ? new Date(value).getTime() : 0;
  }

  isValidDate(value) {
    return Boolean(value) && !Number.isNaN(new Date(value).getTime());
  }

  createId() {
    return Date.now() + Math.floor(Math.random() * 100000);
  }

  createRecordId() {
    return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
};
