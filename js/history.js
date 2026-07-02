window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.HistoryManager = class HistoryManager {
  constructor(storage, categoryManager) {
    this.storage = storage;
    this.categoryManager = categoryManager;
    this.storageKey = "shoppingHistory";
  }

  getAll() {
    const records = this.storage.get(this.storageKey, []);
    return this.normalizeRecords(records);
  }

  normalizeRecords(records) {
    const categories = this.categoryManager.getAll();
    return records.map((record) => {
      const category =
        categories.find((current) => current.id === Number(record.categoryId)) ||
        categories.find((current) => current.name === record.categoryName) ||
        this.categoryManager.getFallback();

      return {
        id: Number(record.id) || Date.now(),
        itemId: Number(record.itemId) || null,
        name: record.name,
        count: Math.max(1, Number(record.count) || 1),
        categoryId: category.id,
        action: record.action || "added",
        date: record.date || record.createdAt || new Date().toISOString(),
      };
    });
  }

  save(records) {
    this.storage.set(this.storageKey, records);
  }

  addRecord(item, action = "added") {
    if (!item) return;
    const record = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      itemId: item.id,
      name: item.name,
      count: item.historyCount ?? item.count,
      categoryId: item.categoryId,
      action,
      date: new Date().toISOString(),
    };
    this.save([record, ...this.getAll()]);
  }

  getRecentMonths(months = 3) {
    const threshold = new Date();
    threshold.setMonth(threshold.getMonth() - months);

    return this.getAll()
      .filter((record) => new Date(record.date) >= threshold)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getProductSuggestions(keyword) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return [];

    const latestByName = new Map();
    this.getAll()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((record) => {
        if (!record.name.toLowerCase().includes(normalizedKeyword)) return;
        if (!latestByName.has(record.name)) latestByName.set(record.name, record);
      });

    return [...latestByName.values()].slice(0, 8);
  }

  replaceCategory(oldCategoryId, newCategoryId) {
    const updatedRecords = this.getAll().map((record) =>
      record.categoryId === oldCategoryId ? { ...record, categoryId: newCategoryId } : record
    );
    this.save(updatedRecords);
  }
};
