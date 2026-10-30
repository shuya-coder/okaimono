const APP_VERSION = "4.1.2";

document.addEventListener("DOMContentLoaded", async () => {
  const { Storage, CategoryManager, ShoppingManager, PurchasedManager, ReceiptDB, ReceiptManager, ReceiptUI, UI } = window.ShoppingApp;
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

  const receiptDB = new ReceiptDB();
  const receiptManager = new ReceiptManager(receiptDB, categoryManager);
  const receiptUI = new ReceiptUI({
    receiptManager,
    categoryManager,
    showToast: (message) => ui.showToast(message),
    showReceiptEditor: () => ui.switchTab("receipts"),
  });
  ui.receiptUI = receiptUI;
  window.ShoppingApp.runtime = { storage, categoryManager, shoppingManager, purchasedManager, receiptDB, receiptManager, receiptUI, ui };
  try {
    await receiptUI.init();
  } catch (error) {
    console.error("Receipt database initialization failed", error);
    ui.showToast("レシート保存機能を初期化できませんでした");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });
  }
});
