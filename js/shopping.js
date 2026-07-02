window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.ShoppingManager = class ShoppingManager {
  constructor(storage, categoryManager) {
    this.storage = storage;
    this.categoryManager = categoryManager;
    this.storageKey = "shoppingItems";
  }

  getAll() {
    const items = this.storage.get(this.storageKey, []);
    return this.normalizeItems(items);
  }

  normalizeItems(items) {
    const categories = this.categoryManager.getAll();
    const fallback = this.categoryManager.getFallback();
    const normalized = items.map((item) => {
      const category =
        categories.find((current) => current.id === Number(item.categoryId)) ||
        categories.find((current) => current.name === item.category) ||
        fallback;

      return {
        id: Number(item.id) || Date.now(),
        name: item.name,
        count: Math.max(1, Number(item.count) || 1),
        categoryId: category.id,
        checked: Boolean(item.checked),
        createdAt: item.createdAt || new Date().toISOString(),
      };
    });
    this.save(normalized);
    return normalized;
  }

  save(items) {
    this.storage.set(this.storageKey, items);
  }

  getSortedItems() {
    return [...this.getAll()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  add({ name, count, categoryId }) {
    const trimmedName = name.trim();
    const safeCount = Math.max(1, Number(count) || 1);
    if (!trimmedName) return null;

    const items = this.getAll();
    const now = new Date().toISOString();
    const existingItem = items.find((item) => item.name === trimmedName);

    if (existingItem) {
      const updatedItems = items.map((item) =>
        item.id === existingItem.id
          ? {
              ...item,
              count: item.count + safeCount,
              categoryId: Number(categoryId),
              checked: false,
              createdAt: now,
            }
          : item
      );
      this.save(updatedItems);
      return { ...updatedItems.find((item) => item.id === existingItem.id), historyCount: safeCount };
    }

    const item = {
      id: Date.now(),
      name: trimmedName,
      count: safeCount,
      categoryId: Number(categoryId),
      checked: false,
      createdAt: now,
    };
    this.save([...items, item]);
    return { ...item, historyCount: safeCount };
  }

  update(id, updates) {
    const updatedItems = this.getAll().map((item) =>
      item.id === id
        ? {
            ...item,
            name: updates.name.trim(),
            count: Math.max(1, Number(updates.count) || 1),
            categoryId: Number(updates.categoryId),
          }
        : item
    );
    this.save(updatedItems);
  }

  changeCount(id, amount) {
    const updatedItems = this.getAll().map((item) =>
      item.id === id
        ? { ...item, count: Math.max(1, item.count + amount), createdAt: new Date().toISOString() }
        : item
    );
    this.save(updatedItems);
  }

  toggleChecked(id) {
    let changedItem = null;
    const updatedItems = this.getAll().map((item) => {
      if (item.id !== id) return item;
      changedItem = { ...item, checked: !item.checked };
      return changedItem;
    });
    this.save(updatedItems);
    return changedItem;
  }

  delete(id) {
    this.save(this.getAll().filter((item) => item.id !== id));
  }

  deleteChecked() {
    this.save(this.getAll().filter((item) => !item.checked));
  }

  replaceCategory(oldCategoryId, newCategoryId) {
    const updatedItems = this.getAll().map((item) =>
      item.categoryId === oldCategoryId ? { ...item, categoryId: newCategoryId } : item
    );
    this.save(updatedItems);
  }
};
