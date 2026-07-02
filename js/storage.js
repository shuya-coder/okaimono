window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.Storage = class Storage {
  constructor(namespace = "shoppingApp") {
    this.namespace = namespace;
  }

  key(name) {
    return `${this.namespace}:${name}`;
  }

  get(name, fallbackValue) {
    const rawValue = localStorage.getItem(this.key(name));
    if (!rawValue) return fallbackValue;

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      console.warn(`LocalStorage parse failed: ${name}`, error);
      return fallbackValue;
    }
  }

  set(name, value) {
    localStorage.setItem(this.key(name), JSON.stringify(value));
  }

  remove(name) {
    localStorage.removeItem(this.key(name));
  }

  clearAppData() {
    // Copy keys first because localStorage length changes while removing items.
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(`${this.namespace}:`)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  }
};
