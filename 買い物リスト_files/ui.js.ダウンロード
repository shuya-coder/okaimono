window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.UI = class UI {
  constructor({ storage, categoryManager, shoppingManager, historyManager, version }) {
    this.storage = storage;
    this.categoryManager = categoryManager;
    this.shoppingManager = shoppingManager;
    this.historyManager = historyManager;
    this.version = version;
    this.historySearch = "";
    this.historyCategoryId = "all";
    this.historyStartDate = "";
    this.historyEndDate = "";
    this.toastTimer = null;
    this.elements = {};
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.applyTheme(this.storage.get("darkMode", false));
    this.elements.appVersion.textContent = this.version;
    this.renderAll();
  }

  cacheElements() {
    this.elements = {
      tabButtons: document.querySelectorAll(".tab-button"),
      tabPanels: document.querySelectorAll(".tab-panel"),
      shoppingCountSummary: document.querySelector("#shoppingCountSummary"),
      shoppingList: document.querySelector("#shoppingList"),
      cartCountSummary: document.querySelector("#cartCountSummary"),
      cartList: document.querySelector("#cartList"),
      checkoutButton: document.querySelector("#checkoutButton"),
      addItemForm: document.querySelector("#addItemForm"),
      itemName: document.querySelector("#itemName"),
      itemCount: document.querySelector("#itemCount"),
      itemCategory: document.querySelector("#itemCategory"),
      decreaseCount: document.querySelector("#decreaseCount"),
      increaseCount: document.querySelector("#increaseCount"),
      historySearch: document.querySelector("#historySearch"),
      historyStartDate: document.querySelector("#historyStartDate"),
      historyEndDate: document.querySelector("#historyEndDate"),
      historyCategoryFilter: document.querySelector("#historyCategoryFilter"),
      historyFilterSummary: document.querySelector("#historyFilterSummary"),
      resetHistoryFilterButton: document.querySelector("#resetHistoryFilterButton"),
      historyCountSummary: document.querySelector("#historyCountSummary"),
      historyList: document.querySelector("#historyList"),
      categoryForm: document.querySelector("#categoryForm"),
      categoryName: document.querySelector("#categoryName"),
      categoryColor: document.querySelector("#categoryColor"),
      categoryList: document.querySelector("#categoryList"),
      darkModeButton: document.querySelector("#darkModeButton"),
      themeQuickToggle: document.querySelector("#themeQuickToggle"),
      exportCsvButton: document.querySelector("#exportCsvButton"),
      importCsvInput: document.querySelector("#importCsvInput"),
      resetStorageButton: document.querySelector("#resetStorageButton"),
      appVersion: document.querySelector("#appVersion"),
      editDialog: document.querySelector("#editDialog"),
      editForm: document.querySelector("#editForm"),
      editItemId: document.querySelector("#editItemId"),
      editName: document.querySelector("#editName"),
      editCount: document.querySelector("#editCount"),
      editCategory: document.querySelector("#editCategory"),
      cancelEditButton: document.querySelector("#cancelEditButton"),
      toast: document.querySelector("#toast"),
    };
  }

  bindEvents() {
    this.elements.tabButtons.forEach((button) => {
      button.addEventListener("click", () => this.switchTab(button.dataset.tab));
    });

    this.elements.shoppingList.addEventListener("click", (event) => this.handleListAction(event));
    this.elements.cartList.addEventListener("click", (event) => this.handleCartAction(event));
    this.elements.checkoutButton.addEventListener("click", () => this.checkoutCart());

    this.elements.addItemForm.addEventListener("submit", (event) => this.handleAddItem(event));
    this.elements.decreaseCount.addEventListener("click", () => this.adjustInputCount(-1));
    this.elements.increaseCount.addEventListener("click", () => this.adjustInputCount(1));

    this.elements.historySearch.addEventListener("input", (event) => {
      this.historySearch = event.target.value.trim().toLowerCase();
      this.renderHistoryList();
      this.renderHistoryFilterSummary();
    });
    this.elements.historyStartDate.addEventListener("change", (event) => {
      this.historyStartDate = event.target.value;
      this.renderHistoryList();
      this.renderHistoryFilterSummary();
    });
    this.elements.historyEndDate.addEventListener("change", (event) => {
      this.historyEndDate = event.target.value;
      this.renderHistoryList();
      this.renderHistoryFilterSummary();
    });
    this.elements.historyCategoryFilter.addEventListener("change", (event) => {
      this.historyCategoryId = event.target.value;
      this.renderHistoryList();
      this.renderHistoryFilterSummary();
    });
    this.elements.resetHistoryFilterButton.addEventListener("click", () => this.resetHistoryFilters());
    this.elements.historyList.addEventListener("click", (event) => this.handleHistoryClick(event));

    this.elements.categoryForm.addEventListener("submit", (event) => this.handleCategorySubmit(event));
    this.elements.categoryList.addEventListener("click", (event) => this.handleCategoryClick(event));
    this.elements.categoryList.addEventListener("change", (event) => this.handleCategoryChange(event));

    this.elements.editForm.addEventListener("submit", (event) => this.handleEditSubmit(event));
    this.elements.cancelEditButton.addEventListener("click", () => this.elements.editDialog.close());

    this.elements.darkModeButton.addEventListener("click", () => this.toggleDarkMode());
    this.elements.themeQuickToggle.addEventListener("click", () => this.toggleDarkMode());
    this.elements.exportCsvButton.addEventListener("click", () => this.exportCsv());
    this.elements.importCsvInput.addEventListener("change", (event) => this.importCsv(event));
    this.elements.resetStorageButton.addEventListener("click", () => this.resetStorage());
  }

  switchTab(tabName) {
    this.elements.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabName;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-current", isActive ? "page" : "false");
    });
    this.elements.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabName));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  handleAddItem(event) {
    event.preventDefault();
    const selectedCategoryId = this.elements.itemCategory.value;
    const item = this.shoppingManager.add({
      name: this.elements.itemName.value,
      count: this.elements.itemCount.value,
      categoryId: selectedCategoryId,
    });
    if (!item) return;

    this.elements.itemName.value = "";
    this.elements.itemCount.value = 1;
    this.elements.itemCategory.value = selectedCategoryId;
    this.renderListAndCart();
    requestAnimationFrame(() => this.elements.itemName.focus({ preventScroll: true }));
    this.showToast("商品を追加しました");
  }

  adjustInputCount(amount) {
    const currentCount = Number(this.elements.itemCount.value) || 1;
    this.elements.itemCount.value = Math.max(1, currentCount + amount);
  }

  handleListAction(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    if (action === "move-cart") {
      const itemId = Number(target.closest("[data-id]")?.dataset.id);
      const item = this.shoppingManager.moveToCart(itemId);
      if (item) {
        this.renderListAndCart();
        this.showToast("カートに入れました");
      }
      return;
    }

    const itemId = Number(target.closest("[data-id]")?.dataset.id);
    if (!itemId) return;
    if (action === "increase") this.shoppingManager.changeCount(itemId, 1);
    if (action === "decrease") this.shoppingManager.changeCount(itemId, -1);
    if (action === "edit") this.openEditDialog(itemId);
    if (action === "delete" && confirm("本当に削除しますか？")) this.shoppingManager.delete(itemId);
    this.renderListAndCart();
  }

  handleCartAction(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const itemId = Number(target.closest("[data-id]")?.dataset.id);
    if (!itemId) return;

    if (target.dataset.action === "return-list") {
      this.shoppingManager.moveToList(itemId);
      this.renderListAndCart();
      this.showToast("リストに戻しました");
      return;
    }

    if (target.dataset.action === "increase") this.shoppingManager.changeCount(itemId, 1);
    if (target.dataset.action === "decrease") this.shoppingManager.changeCount(itemId, -1);
    if (target.dataset.action === "delete" && confirm("本当に削除しますか？")) this.shoppingManager.delete(itemId);
    this.renderListAndCart();
  }

  checkoutCart() {
    const cartItems = this.shoppingManager.getCartItems();
    if (cartItems.length === 0) return;
    if (!confirm("カートの商品を会計済みにしますか？")) return;

    const checkedOutItems = this.shoppingManager.checkoutCart();
    checkedOutItems.forEach((item) => this.historyManager.addRecord(item, "purchased"));
    this.renderListAndCart();
    this.renderHistoryList();
    this.showToast("会計済みにしました");
  }

  handleHistoryClick(event) {
    const recordDeleteButton = event.target.closest("[data-action='delete-history-record']");
    if (recordDeleteButton) {
      const recordId = Number(recordDeleteButton.closest("[data-history-id]").dataset.historyId);
      if (!confirm("本当に削除しますか？")) return;
      this.historyManager.deleteRecord(recordId);
      this.renderHistoryList();
      this.showToast("履歴を削除しました");
      return;
    }

    const dayDeleteButton = event.target.closest("[data-action='delete-history-day']");
    if (dayDeleteButton) {
      const dateKey = dayDeleteButton.closest("[data-date-key]").dataset.dateKey;
      if (!confirm("この日の履歴を本当に削除しますか？")) return;
      this.historyManager.deleteByDate(dateKey);
      this.renderHistoryList();
      this.showToast("この日の履歴を削除しました");
    }
  }

  handleCategorySubmit(event) {
    event.preventDefault();
    this.categoryManager.add({
      name: this.elements.categoryName.value,
      color: this.elements.categoryColor.value,
    });
    event.target.reset();
    this.elements.categoryColor.value = "#4CAF50";
    this.renderAll();
    this.showToast("カテゴリーを追加しました");
  }

  handleCategoryChange(event) {
    const row = event.target.closest("[data-id]");
    if (!row) return;
    const id = Number(row.dataset.id);
    this.categoryManager.update(id, {
      name: row.querySelector("[data-field='name']").value,
      color: row.querySelector("[data-field='color']").value,
    });
    this.renderAll();
    this.showToast("カテゴリーを更新しました");
  }

  handleCategoryClick(event) {
    const deleteButton = event.target.closest("[data-action='delete-category']");
    if (!deleteButton) return;
    const id = Number(deleteButton.closest("[data-id]").dataset.id);
    const categories = this.categoryManager.getAll();
    if (categories.length <= 1) {
      alert("カテゴリーは最低1件必要です。");
      return;
    }
    if (!confirm("本当に削除しますか？")) return;
    const fallback = categories.find((category) => category.id !== id);
    this.categoryManager.delete(id);
    this.shoppingManager.replaceCategory(id, fallback.id);
    this.historyManager.replaceCategory(id, fallback.id);
    this.renderAll();
    this.showToast("カテゴリーを削除しました");
  }

  openEditDialog(itemId) {
    const item = this.shoppingManager.getAll().find((current) => current.id === itemId);
    if (!item) return;
    this.fillCategorySelect(this.elements.editCategory, this.categoryManager.getAll());
    this.elements.editItemId.value = item.id;
    this.elements.editName.value = item.name;
    this.elements.editCount.value = item.count;
    this.elements.editCategory.value = item.categoryId;
    this.elements.editDialog.showModal();
  }

  handleEditSubmit(event) {
    event.preventDefault();
    this.shoppingManager.update(Number(this.elements.editItemId.value), {
      name: this.elements.editName.value,
      count: this.elements.editCount.value,
      categoryId: this.elements.editCategory.value,
    });
    this.elements.editDialog.close();
    this.renderListAndCart();
    this.showToast("保存しました");
  }

  resetHistoryFilters() {
    this.historySearch = "";
    this.historyStartDate = "";
    this.historyEndDate = "";
    this.historyCategoryId = "all";
    this.elements.historySearch.value = "";
    this.elements.historyStartDate.value = "";
    this.elements.historyEndDate.value = "";
    this.elements.historyCategoryFilter.value = "all";
    this.renderHistoryList();
    this.renderHistoryFilterSummary();
  }

  renderAll() {
    this.renderCategoryOptions();
    this.renderListAndCart();
    this.renderHistoryList();
    this.renderCategories();
    this.renderHistoryFilterSummary();
  }

  renderListAndCart() {
    this.renderShoppingList();
    this.renderCartList();
  }

  renderCategoryOptions() {
    const categories = this.categoryManager.getAll();
    this.fillCategorySelect(this.elements.itemCategory, categories);
    this.fillCategorySelect(this.elements.editCategory, categories);
    this.fillFilterSelect(this.elements.historyCategoryFilter, categories, this.historyCategoryId);
  }

  fillCategorySelect(selectElement, categories) {
    selectElement.innerHTML = categories
      .map((category) => `<option value="${category.id}">${this.escapeHtml(category.name)}</option>`)
      .join("");
  }

  fillFilterSelect(selectElement, categories, selectedValue) {
    selectElement.innerHTML = [
      `<option value="all">すべて</option>`,
      ...categories.map((category) => `<option value="${category.id}">${this.escapeHtml(category.name)}</option>`),
    ].join("");
    selectElement.value = selectedValue;
  }

  renderShoppingList() {
    const items = this.shoppingManager.getListItems();
    this.elements.shoppingCountSummary.textContent = `${items.length}件`;
    if (items.length === 0) {
      this.elements.shoppingList.innerHTML = `<p class="empty-message">リストの商品はありません。</p>`;
      return;
    }
    this.elements.shoppingList.innerHTML = items.map((item) => this.createListItemHtml(item)).join("");
  }

  renderCartList() {
    const items = this.shoppingManager.getCartItems();
    this.elements.cartCountSummary.textContent = `${items.length}件`;
    this.elements.checkoutButton.disabled = items.length === 0;
    if (items.length === 0) {
      this.elements.cartList.innerHTML = `<p class="empty-message">カートは空です。</p>`;
      return;
    }
    this.elements.cartList.innerHTML = items.map((item) => this.createCartItemHtml(item)).join("");
  }

  createListItemHtml(item) {
    return this.createItemHtml(item, {
      leadingHtml: `
        <div class="cart-icon" aria-hidden="true">📝</div>
      `,
      actionsHtml: `
        <button class="small-button move-cart-button" type="button" data-action="move-cart" aria-label="カートへ入れる">カート</button>
        <button class="small-button" type="button" data-action="increase">＋</button>
        <button class="small-button" type="button" data-action="decrease">−</button>
        <button class="small-button danger" type="button" data-action="delete">削除</button>
      `,
    });
  }

  createCartItemHtml(item) {
    return this.createItemHtml(item, {
      leadingHtml: `<div class="cart-icon" aria-hidden="true">🛒</div>`,
      actionsHtml: `
        <button class="small-button return-list-button" type="button" data-action="return-list" aria-label="リストに戻す">戻す</button>
        <button class="small-button" type="button" data-action="increase">＋</button>
        <button class="small-button" type="button" data-action="decrease">−</button>
        <button class="small-button danger" type="button" data-action="delete">削除</button>
      `,
    });
  }

  createItemHtml(item, { leadingHtml, actionsHtml }) {
    const category = this.categoryManager.findById(item.categoryId) || this.categoryManager.getFallback();
    return `
      <article class="shopping-item" data-id="${item.id}" style="--category-color:${this.escapeHtml(category.color)}">
        ${leadingHtml}
        <div class="item-main">
          <p class="item-name">${this.escapeHtml(item.name)} ×${item.count}</p>
          <div class="item-meta">
            <span><span class="color-dot" style="background:${this.escapeHtml(category.color)}"></span>${this.escapeHtml(category.name)}</span>
            <span>${this.formatDateTime(item.createdAt)}</span>
          </div>
        </div>
        <div class="item-actions">${actionsHtml}</div>
      </article>
    `;
  }

  renderHistoryList() {
    const records = this.historyManager
      .getRecentMonths(3)
      .filter((record) => record.action === "purchased")
      .filter((record) => record.name.toLowerCase().includes(this.historySearch))
      .filter((record) => this.historyCategoryId === "all" || String(record.categoryId) === this.historyCategoryId)
      .filter((record) => this.isInHistoryDateRange(record.date));
    this.elements.historyCountSummary.textContent = `${records.length}件`;
    if (records.length === 0) {
      this.elements.historyList.innerHTML = `<p class="empty-message">条件に合う履歴はありません。</p>`;
      return;
    }
    const groups = this.historyManager.groupByDate(records);
    this.elements.historyList.innerHTML = groups.map((group) => this.createHistoryGroupHtml(group)).join("");
  }

  isInHistoryDateRange(value) {
    const dateKey = this.historyManager.getDateKey(value);
    if (this.historyStartDate && dateKey < this.historyStartDate) return false;
    if (this.historyEndDate && dateKey > this.historyEndDate) return false;
    return true;
  }

  createHistoryGroupHtml(group) {
    return `
      <section class="history-group" data-date-key="${group.dateKey}">
        <div class="history-group-header">
          <h2>${this.formatDateHeader(group.dateKey)}</h2>
          <button class="small-button danger" type="button" data-action="delete-history-day">この日の履歴を削除</button>
        </div>
        <div class="history-group-items">${group.items.map((record) => this.createHistoryItemHtml(record)).join("")}</div>
      </section>
    `;
  }

  createHistoryItemHtml(record) {
    const category = this.categoryManager.findById(record.categoryId) || this.categoryManager.getFallback();
    const label = record.action === "purchased" ? "購入" : "追加";
    return `
      <article class="history-item" data-history-id="${record.id}" style="--category-color:${this.escapeHtml(category.color)}">
        <div class="item-main">
          <p class="item-name">${this.escapeHtml(record.name)} ×${record.count}</p>
          <div class="item-meta">
            <span>${label}</span>
            <span><span class="color-dot" style="background:${this.escapeHtml(category.color)}"></span>${this.escapeHtml(category.name)}</span>
            <span>${this.formatTime(record.date)}</span>
          </div>
        </div>
        <div class="history-actions">
          <button class="small-button danger" type="button" data-action="delete-history-record">削除</button>
        </div>
      </article>
    `;
  }

  renderCategories() {
    const categories = this.categoryManager.getAll();
    this.elements.categoryList.innerHTML = categories
      .map(
        (category) => `
          <article class="category-item" data-id="${category.id}">
            <span class="color-dot large" style="background:${this.escapeHtml(category.color)}" aria-hidden="true"></span>
            <input data-field="name" type="text" value="${this.escapeHtml(category.name)}" aria-label="カテゴリー名">
            <input data-field="color" type="color" value="${this.escapeHtml(category.color)}" aria-label="${this.escapeHtml(category.name)}の色">
            <button class="small-button danger" type="button" data-action="delete-category">削除</button>
          </article>
        `
      )
      .join("");
  }

  renderHistoryFilterSummary() {
    const parts = [];
    if (this.historySearch) parts.push(`検索中: ${this.historySearch}`);
    if (this.historyStartDate || this.historyEndDate) parts.push(`日付: ${this.historyStartDate || "指定なし"}〜${this.historyEndDate || "指定なし"}`);
    if (this.historyCategoryId !== "all") parts.push(`カテゴリー: ${this.getCategoryName(this.historyCategoryId)}`);
    this.elements.historyFilterSummary.textContent =
      parts.length > 0 ? parts.join(" / ") : "商品名・日付・カテゴリーで絞り込み";
  }

  getCategoryName(categoryId) {
    return this.categoryManager.findById(Number(categoryId))?.name ?? "不明";
  }

  toggleDarkMode() {
    const nextValue = !document.body.classList.contains("dark-mode");
    this.applyTheme(nextValue);
    this.storage.set("darkMode", nextValue);
    this.showToast(nextValue ? "ダークモードにしました" : "ライトモードにしました");
  }

  applyTheme(isDarkMode) {
    document.body.classList.toggle("dark-mode", isDarkMode);
    this.elements.themeQuickToggle.textContent = isDarkMode ? "☀" : "🌙";
  }

  exportCsv() {
    const rows = [
      ["type", "id", "name", "count", "categoryId", "status", "date", "color", "action"],
      ...this.shoppingManager.getAll().map((item) => ["shopping", item.id, item.name, item.count, item.categoryId, item.status, item.createdAt, "", ""]),
      ...this.categoryManager.getAll().map((category) => ["category", category.id, category.name, "", "", "", "", category.color, ""]),
      ...this.historyManager.getAll().map((record) => ["history", record.id, record.name, record.count, record.categoryId, "", record.date, "", record.action]),
    ];
    const csv = rows.map((row) => row.map((value) => this.escapeCsv(value)).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shopping-list-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.showToast("CSVを保存しました");
  }

  async importCsv(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = this.parseCsv(text.replace(/^\uFEFF/, ""));
    const [, ...dataRows] = rows;
    const imported = { shoppingItems: [], categories: [], shoppingHistory: [] };
    dataRows.forEach(([type, id, name, count, categoryId, status, date, color, action]) => {
      if (!type || !name) return;
      const numericId = Number(id) || Date.now() + Math.floor(Math.random() * 10000);
      if (type === "category") imported.categories.push({ id: numericId, name, color: color || "#607D8B" });
      if (type === "shopping") {
        imported.shoppingItems.push({
          id: numericId,
          name,
          count: Math.max(1, Number(count) || 1),
          categoryId: Number(categoryId),
          status: status === "cart" ? "cart" : "list",
          createdAt: date || new Date().toISOString(),
        });
      }
      if (type === "history") {
        imported.shoppingHistory.push({
          id: numericId,
          name,
          count: Math.max(1, Number(count) || 1),
          categoryId: Number(categoryId),
          action: action || "added",
          date: date || new Date().toISOString(),
        });
      }
    });
    if (imported.categories.length === 0) {
      alert("カテゴリーが含まれていないためインポートできません。");
      event.target.value = "";
      return;
    }
    this.storage.set("categories", imported.categories);
    this.storage.set("shoppingItems", imported.shoppingItems);
    this.storage.set("shoppingHistory", imported.shoppingHistory);
    event.target.value = "";
    this.renderAll();
    this.showToast("CSVを読み込みました");
  }

  resetStorage() {
    if (!confirm("本当に削除しますか？")) return;
    this.storage.clearAppData();
    this.applyTheme(false);
    this.renderAll();
    this.showToast("初期化しました");
  }

  showToast(message) {
    window.clearTimeout(this.toastTimer);
    this.elements.toast.textContent = message;
    this.elements.toast.classList.add("visible");
    this.toastTimer = window.setTimeout(() => this.elements.toast.classList.remove("visible"), 1600);
  }

  parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];
      if (char === '"' && inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  escapeCsv(value) {
    const stringValue = String(value ?? "");
    if (!/[",\n\r]/.test(stringValue)) return stringValue;
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  formatDateTime(value) {
    return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  formatTime(value) {
    return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  formatDateHeader(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).format(date);
  }
};
