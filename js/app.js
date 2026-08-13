const APP_VERSION = "2.0.1";

document.addEventListener("DOMContentLoaded", () => {
  const { Storage, CategoryManager, ShoppingManager, PurchasedManager, UI } = window.ShoppingApp;
  const storage = new Storage();
  const categoryManager = new CategoryManager(storage);
  const shoppingManager = new ShoppingManager(storage, categoryManager);
  const purchasedManager = new PurchasedManager(storage, categoryManager);

  const ui = new UI({
    storage,
    categoryManager,
    shoppingManager,
    purchasedManager,
    version: APP_VERSION,
  });

  ui.init();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });
  }
});
