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

      const legacyChecked = item.checked === true || item.checked === "true";
      const status = item.status === "cart" || (!item.status && legacyChecked) ? "cart" : "list";

      return {
        id: Number(item.id) || this.createId(),
        name: item.name,
        count: Math.max(1, Number(item.count) || 1),
        categoryId: category.id,
        status,
        checked: status === "cart",
        createdAt: item.createdAt || new Date().toISOString(),
      };
    });
    this.save(normalized);
    return normalized;
  }

  save(items) {
    this.storage.set(this.storageKey, items);
  }

  getListItems() {
    return this.getByStatus("list");
  }

  getCartItems() {
    return this.getByStatus("cart");
  }

  getByStatus(status) {
    return this.getAll()
      .filter((item) => item.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getSortedItems() {
    return this.getListItems();
  }

  add({ name, count, categoryId }) {
    const trimmedName = name.trim();
    const safeCount = Math.max(1, Number(count) || 1);
    if (!trimmedName) return null;

    const items = this.getAll();
    const existingItem = items.find((item) => item.name === trimmedName && item.status === "list");
    const now = new Date().toISOString();

    if (existingItem) {
      const updatedItem = {
        ...existingItem,
        count: existingItem.count + safeCount,
        categoryId: Number(categoryId),
        createdAt: now,
      };
      // 同じミリ秒で複数回追加されても、更新した商品が確実に先頭へ来るよう配列順も更新する。
      this.save([updatedItem, ...items.filter((item) => item.id !== existingItem.id)]);
      return { ...updatedItem, historyCount: safeCount };
    }

    const item = {
      id: this.createId(),
      name: trimmedName,
      count: safeCount,
      categoryId: Number(categoryId),
      status: "list",
      checked: false,
      createdAt: now,
    };
    this.save([item, ...items]);
    return { ...item, historyCount: safeCount };
  }

  createId() {
    return Date.now() + Math.floor(Math.random() * 100000);
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

  moveToCart(id) {
    return this.setStatus(id, "cart");
  }

  moveToList(id) {
    return this.setStatus(id, "list");
  }

  setStatus(id, status) {
    let movedItem = null;
    const updatedItems = this.getAll().map((item) => {
      if (item.id !== id) return item;
      movedItem = { ...item, status, checked: status === "cart", createdAt: new Date().toISOString() };
      return movedItem;
    });
    this.save(updatedItems);
    return movedItem;
  }

  setChecked(id, checked) {
    return checked ? this.moveToCart(id) : this.moveToList(id);
  }

  checkoutCart() {
    const cartItems = this.getCartItems();
    this.save(this.getAll().filter((item) => item.status !== "cart"));
    return cartItems;
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
