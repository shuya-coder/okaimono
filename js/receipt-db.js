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

  getAllReceipts() {
    return this.run("receipts", "readonly", (store) => store.getAll());
  }

  getReceipt(id) {
    return this.run("receipts", "readonly", (store) => store.get(id));
  }

  saveReceipt(receipt) {
    return this.run("receipts", "readwrite", (store) => store.put(receipt));
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
      receipts.forEach((receipt) => receiptStore.put(receipt));
      mappings.forEach((mapping) => mappingStore.put(mapping));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAll() {
    await this.replaceAll({ receipts: [], mappings: [] });
  }
};
