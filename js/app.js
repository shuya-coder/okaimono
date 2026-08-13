const APP_VERSION = "1.3.0";

document.addEventListener("DOMContentLoaded", () => {
  const { Storage, CategoryManager, ShoppingManager, HistoryManager, UI } = window.ShoppingApp;
  const storage = new Storage();
  const categoryManager = new CategoryManager(storage);
  const shoppingManager = new ShoppingManager(storage, categoryManager);
  const historyManager = new HistoryManager(storage, categoryManager);

  const ui = new UI({
    storage,
    categoryManager,
    shoppingManager,
    historyManager,
    version: APP_VERSION,
  });

  ui.init();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  }
});
