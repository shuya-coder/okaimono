window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.ReceiptDB = class ReceiptDB {
  constructor(name = "shoppingAppReceipts") {
    this.name = name;
    this.version = 1;
    this.dbPromise = null;
  }

  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("receipts")) {
          const store = db.createObjectStore("receipts", { keyPath: "id" });
          store.createIndex("purchasedAt", "purchasedAt");
          store.createIndex("fingerprint", "fingerprint");
        }
        if (!db.objectStoreNames.contains("mappings")) {
          db.createObjectStore("mappings", { keyPath: "alias" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  async run(storeName, mode, operation) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let request;
      try {
        request = operation(store);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async getAllReceipts() {
    const receipts = await this.run("receipts", "readonly", (store) => store.getAll());
    const sanitized = receipts.map((receipt) => this.sanitizeReceipt(receipt));
    const changed = receipts.some((receipt) => this.hasTransientData(receipt));
    if (changed) {
      await Promise.all(sanitized.map((receipt) => this.saveReceipt(receipt)));
    }
    return sanitized;
  }

  async getReceipt(id) {
    const receipt = await this.run("receipts", "readonly", (store) => store.get(id));
    if (!receipt) return receipt;
    const sanitized = this.sanitizeReceipt(receipt);
    if (this.hasTransientData(receipt) || "rawText" in receipt) await this.saveReceipt(sanitized);
    return sanitized;
  }

  saveReceipt(receipt) {
    return this.run("receipts", "readwrite", (store) => store.put(this.sanitizeReceipt(receipt)));
  }

  deleteReceipt(id) {
    return this.run("receipts", "readwrite", (store) => store.delete(id));
  }

  getAllMappings() {
    return this.run("mappings", "readonly", (store) => store.getAll());
  }

  saveMapping(mapping) {
    return this.run("mappings", "readwrite", (store) => store.put(mapping));
  }

  async replaceAll({ receipts = [], mappings = [] }) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["receipts", "mappings"], "readwrite");
      const receiptStore = transaction.objectStore("receipts");
      const mappingStore = transaction.objectStore("mappings");
      receiptStore.clear();
      mappingStore.clear();
      receipts.forEach((receipt) => receiptStore.put(this.sanitizeReceipt(receipt)));
      mappings.forEach((mapping) => mappingStore.put(mapping));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAll() {
    await this.replaceAll({ receipts: [], mappings: [] });
  }

  sanitizeReceipt(receipt) {
    if (!receipt || typeof receipt !== "object") return receipt;
    return this.sanitizeObject(receipt);
  }

  sanitizeItem(item) {
    if (!item || typeof item !== "object") return item;
    return this.sanitizeObject(item);
  }

  sanitizeObject(object) {
    return Object.fromEntries(
      Object.entries(object).flatMap(([key, value]) => {
        if (this.isTransientKey(key) || this.isImageValue(value)) return [];
        if (Array.isArray(value)) return [[key, value.map((item) => item && typeof item === "object" ? this.sanitizeObject(item) : item)]];
        if (value && typeof value === "object") return [[key, this.sanitizeObject(value)]];
        return [[key, value]];
      })
    );
  }

  hasTransientData(value) {
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, child]) => {
      if (this.isTransientKey(key) || this.isImageValue(child)) return true;
      if (Array.isArray(child)) return child.some((item) => this.hasTransientData(item));
      return child && typeof child === "object" ? this.hasTransientData(child) : false;
    });
  }

  isTransientKey(key) {
    return /^(rawText|image|imageData|receiptImage|photo|photoData|blob|file)$/i.test(String(key));
  }

  isImageValue(value) {
    if (typeof value === "string" && /^data:image\//i.test(value)) return true;
    return typeof Blob !== "undefined" && value instanceof Blob;
  }
};
