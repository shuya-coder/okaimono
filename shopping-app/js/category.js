window.ShoppingApp = window.ShoppingApp || {};

const DEFAULT_CATEGORIES = [
  { name: "食料品", color: "#4CAF50" },
  { name: "日用品", color: "#2196F3" },
];

const LEGACY_DEFAULT_CATEGORY_NAMES = ["飲み物", "野菜", "肉", "パン", "お菓子", "冷凍食品"];

window.ShoppingApp.CategoryManager = class CategoryManager {
  constructor(storage) {
    this.storage = storage;
    this.storageKey = "categories";
  }

  getAll() {
    const savedCategories = this.storage.get(this.storageKey, null);
    if (Array.isArray(savedCategories) && savedCategories.length > 0) {
      return this.normalizeCategories(savedCategories);
    }

    const initialCategories = DEFAULT_CATEGORIES.map((category, index) => ({
      id: Date.now() + index,
      ...category,
    }));
    this.save(initialCategories);
    return initialCategories;
  }

  normalizeCategories(categories) {
    const normalized = categories
      .filter((category) => !LEGACY_DEFAULT_CATEGORY_NAMES.includes(category.name))
      .map((category, index) => ({
      id: Number(category.id) || Date.now() + index,
      name: category.name,
      color: category.color || DEFAULT_CATEGORIES[index]?.color || "#607D8B",
    }));

    const withRequiredDefaults = DEFAULT_CATEGORIES.reduce((currentCategories, defaultCategory, index) => {
      if (currentCategories.some((category) => category.name === defaultCategory.name)) return currentCategories;
      return [
        ...currentCategories,
        {
          id: Date.now() + index,
          ...defaultCategory,
        },
      ];
    }, normalized);

    this.save(withRequiredDefaults);
    return withRequiredDefaults;
  }

  save(categories) {
    this.storage.set(this.storageKey, categories);
  }

  add({ name, color }) {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const categories = this.getAll();
    if (categories.some((category) => category.name === trimmedName)) return null;

    const category = {
      id: Date.now(),
      name: trimmedName,
      color: color || "#607D8B",
    };
    this.save([...categories, category]);
    return category;
  }

  update(id, updates) {
    const trimmedName = updates.name.trim();
    if (!trimmedName) return null;

    const categories = this.getAll();
    if (categories.some((category) => category.id !== id && category.name === trimmedName)) return null;

    const updatedCategories = categories.map((category) =>
      category.id === id ? { ...category, name: trimmedName, color: updates.color || category.color } : category
    );
    this.save(updatedCategories);
    return updatedCategories.find((category) => category.id === id) ?? null;
  }

  delete(id) {
    this.save(this.getAll().filter((category) => category.id !== id));
  }

  findById(id) {
    return this.getAll().find((category) => category.id === Number(id));
  }

  getFallback() {
    return this.getAll()[0] ?? { id: 0, name: "未分類", color: "#607D8B" };
  }
};
