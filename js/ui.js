window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.UI = class UI {
  constructor({ storage, categoryManager, shoppingManager, purchasedManager, version }) {
    this.storage = storage;
    this.categoryManager = categoryManager;
    this.shoppingManager = shoppingManager;
    this.purchasedManager = purchasedManager;
    this.version = version;
    this.purchasedSearch = "";
    this.purchasedCategoryId = "all";
    this.purchasedSort = "recent";
    const savedHistoryView = this.storage.get("historyView", "recent");
    this.historyView = ["receipts", "recent", "products"].includes(savedHistoryView) ? savedHistoryView : "recent";
    this.receiptUI = null;
    this.pendingBackup = null;
    this.pendingPurchaseUndo = null;
    this.toastTimer = null;
    this.keyboardTimer = null;
    this.isComposingItemName = false;
    this.pendingAddAfterComposition = false;
    this.viewportMaxHeight = window.visualViewport?.height || window.innerHeight;
    this.viewportBaselineWidth = window.visualViewport?.width || window.innerWidth;
    this.viewportLastHeight = this.viewportMaxHeight;
    this.keyboardOpen = false;
    this.elements = {};
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.applyTheme(this.storage.get("darkMode", false));
    this.elements.appVersion.textContent = this.version;
    this.renderAll();
    this.elements.addItemPanel.open = this.shoppingManager.getListItems().length === 0;
    this.switchHistoryView(this.historyView, { persist: false });
  }

  cacheElements() {
    this.elements = {
      tabButtons: document.querySelectorAll(".tab-button"),
      tabPanels: document.querySelectorAll(".tab-panel"),
      historyViewButtons: document.querySelectorAll(".history-view-button"),
      historyViewPanels: document.querySelectorAll(".history-view"),
      shoppingCountSummary: document.querySelector("#shoppingCountSummary"),
      shoppingList: document.querySelector("#shoppingList"),
      addItemPanel: document.querySelector("#addItemPanel"),
      addItemForm: document.querySelector("#addItemForm"),
      addItemButton: document.querySelector("#addItemButton"),
      itemName: document.querySelector("#itemName"),
      itemCount: document.querySelector("#itemCount"),
      itemCategory: document.querySelector("#itemCategory"),
      decreaseCount: document.querySelector("#decreaseCount"),
      increaseCount: document.querySelector("#increaseCount"),
      purchasedSearch: document.querySelector("#purchasedSearch"),
      purchasedCategoryFilter: document.querySelector("#purchasedCategoryFilter"),
      purchasedSort: document.querySelector("#purchasedSort"),
      purchaseRecordCountSummary: document.querySelector("#purchaseRecordCountSummary"),
      purchaseRecordList: document.querySelector("#purchaseRecordList"),
      purchasedCountSummary: document.querySelector("#purchasedCountSummary"),
      purchasedList: document.querySelector("#purchasedList"),
      categoryForm: document.querySelector("#categoryForm"),
      categoryName: document.querySelector("#categoryName"),
      categoryColor: document.querySelector("#categoryColor"),
      categoryList: document.querySelector("#categoryList"),
      darkModeButton: document.querySelector("#darkModeButton"),
      themeQuickToggle: document.querySelector("#themeQuickToggle"),
      exportCsvButton: document.querySelector("#exportCsvButton"),
      importCsvInput: document.querySelector("#importCsvInput"),
      exportJsonButton: document.querySelector("#exportJsonButton"),
      importJsonInput: document.querySelector("#importJsonInput"),
      backupPreviewDialog: document.querySelector("#backupPreviewDialog"),
      backupPreview: document.querySelector("#backupPreview"),
      cancelBackupImport: document.querySelector("#cancelBackupImport"),
      confirmBackupImport: document.querySelector("#confirmBackupImport"),
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
      toastMessage: document.querySelector("#toastMessage"),
      toastUndoButton: document.querySelector("#toastUndoButton"),
    };
  }

  bindEvents() {
    this.elements.tabButtons.forEach((button) => {
      button.addEventListener("click", () => this.switchTab(button.dataset.tab));
    });
    this.elements.historyViewButtons.forEach((button) => {
      button.addEventListener("click", () => this.switchHistoryView(button.dataset.historyView));
    });

    this.elements.shoppingList.addEventListener("click", (event) => this.handleListAction(event));

    this.elements.addItemForm.addEventListener("submit", (event) => this.handleAddItem(event));
    this.elements.addItemPanel.addEventListener("toggle", () => {
      if (this.isComposingItemName && !this.elements.addItemPanel.open) this.elements.addItemPanel.open = true;
    });
    this.elements.itemName.addEventListener("compositionstart", () => this.handleItemCompositionStart());
    this.elements.itemName.addEventListener("compositionend", () => this.handleItemCompositionEnd());
    this.elements.addItemButton.addEventListener("touchstart", (event) => {
      if (this.isComposingItemName) return;
      event.preventDefault();
      this.elements.addItemForm.requestSubmit();
    }, { passive: false });
    this.elements.decreaseCount.addEventListener("click", () => this.adjustInputCount(-1));
    this.elements.increaseCount.addEventListener("click", () => this.adjustInputCount(1));

    this.elements.purchasedSearch.addEventListener("input", (event) => {
      this.purchasedSearch = event.target.value.trim().toLocaleLowerCase("ja-JP");
      this.renderPurchasedList();
    });
    this.elements.purchasedCategoryFilter.addEventListener("change", (event) => {
      this.purchasedCategoryId = event.target.value;
      this.renderPurchasedList();
    });
    this.elements.purchasedSort.addEventListener("change", (event) => {
      this.purchasedSort = event.target.value;
      this.renderPurchasedList();
    });
    this.elements.purchaseRecordList.addEventListener("click", (event) => this.handlePurchasedClick(event));
    this.elements.purchasedList.addEventListener("click", (event) => this.handlePurchasedClick(event));

    this.elements.categoryForm.addEventListener("submit", (event) => this.handleCategorySubmit(event));
    this.elements.categoryList.addEventListener("click", (event) => this.handleCategoryClick(event));
    this.elements.categoryList.addEventListener("change", (event) => this.handleCategoryChange(event));

    this.elements.editForm.addEventListener("submit", (event) => this.handleEditSubmit(event));
    this.elements.cancelEditButton.addEventListener("click", () => this.elements.editDialog.close());
    this.elements.toastUndoButton.addEventListener("click", () => this.undoLastPurchase());

    this.elements.darkModeButton.addEventListener("click", () => this.toggleDarkMode());
    this.elements.themeQuickToggle.addEventListener("click", () => this.toggleDarkMode());
    this.elements.exportCsvButton.addEventListener("click", () => this.exportCsv());
    this.elements.importCsvInput.addEventListener("change", (event) => this.importCsv(event));
    this.elements.exportJsonButton.addEventListener("click", () => this.exportJson());
    this.elements.importJsonInput.addEventListener("change", (event) => this.prepareJsonImport(event));
    this.elements.cancelBackupImport.addEventListener("click", () => this.cancelJsonImport());
    this.elements.confirmBackupImport.addEventListener("click", () => this.confirmJsonImport());
    this.elements.resetStorageButton.addEventListener("click", () => this.resetStorage());

    document.addEventListener("focusin", (event) => this.handleKeyboardFocus(event));
    document.addEventListener("focusout", () => this.handleKeyboardBlur());
    window.visualViewport?.addEventListener("resize", () => this.scheduleKeyboardStateUpdate());
    window.visualViewport?.addEventListener("scroll", () => this.scheduleKeyboardStateUpdate());
    window.addEventListener("resize", () => this.scheduleKeyboardStateUpdate());
    window.addEventListener("orientationchange", () => {
      window.setTimeout(() => {
        this.viewportMaxHeight = window.visualViewport?.height || window.innerHeight;
        this.viewportBaselineWidth = window.visualViewport?.width || window.innerWidth;
        this.viewportLastHeight = this.viewportMaxHeight;
        this.keyboardOpen = false;
        document.body.classList.remove("keyboard-open");
      }, 300);
    });
  }

  switchTab(tabName) {
    this.elements.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabName;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-current", isActive ? "page" : "false");
    });
    this.elements.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabName));
    if ((tabName === "receipts" || tabName === "purchased") && this.receiptUI) this.receiptUI.renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  switchHistoryView(viewName, { persist = true } = {}) {
    if (!["receipts", "recent", "products"].includes(viewName)) viewName = "recent";
    this.historyView = viewName;
    if (persist) this.storage.set("historyView", viewName);
    this.elements.historyViewButtons.forEach((button) => {
      const isActive = button.dataset.historyView === viewName;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    this.elements.historyViewPanels.forEach((panel) => {
      const isActive = panel.dataset.historyPanel === viewName;
      panel.classList.toggle("active", isActive);
      panel.hidden = !isActive;
    });
    if (viewName === "receipts" && this.receiptUI) this.receiptUI.renderAll();
  }

  isKeyboardInput(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.tagName === "TEXTAREA") return true;
    if (element.tagName !== "INPUT") return false;
    return !["button", "checkbox", "color", "file", "hidden", "radio", "range", "reset", "submit"].includes(element.type);
  }

  handleKeyboardFocus(event) {
    if (!this.isKeyboardInput(event.target) || window.innerWidth > 760) return;
    if (!this.keyboardOpen) {
      this.viewportMaxHeight = Math.max(this.viewportMaxHeight, window.visualViewport?.height || window.innerHeight);
    }
    this.scheduleKeyboardStateUpdate();
  }

  handleKeyboardBlur() {
    this.scheduleKeyboardStateUpdate();
  }

  scheduleKeyboardStateUpdate() {
    window.clearTimeout(this.keyboardTimer);
    this.updateKeyboardState();
    requestAnimationFrame(() => this.updateKeyboardState());
    this.keyboardTimer = window.setTimeout(() => this.updateKeyboardState(), 280);
  }

  updateKeyboardState() {
    const viewport = window.visualViewport;
    if (!viewport || window.innerWidth > 760) {
      this.keyboardOpen = false;
      document.body.classList.remove("keyboard-open");
      return;
    }
    if (Math.abs(viewport.width - this.viewportBaselineWidth) > 60) {
      this.viewportBaselineWidth = viewport.width;
      this.viewportMaxHeight = viewport.height;
      this.viewportLastHeight = viewport.height;
      this.keyboardOpen = false;
      document.body.classList.remove("keyboard-open");
      return;
    }

    const heightLoss = Math.max(0, this.viewportMaxHeight - viewport.height);
    const layoutOverlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    const heightExpansion = viewport.height - this.viewportLastHeight;
    const activeInput = this.isKeyboardInput(document.activeElement);
    const likelyOpen = heightLoss > 160 || layoutOverlap > 160;
    const likelyClosed = heightLoss < 125 && layoutOverlap < 125;

    if (this.keyboardOpen) {
      if (heightExpansion > 100 || likelyClosed) this.keyboardOpen = false;
    } else if (activeInput && viewport.scale <= 1.05 && likelyOpen) {
      this.keyboardOpen = true;
    }

    document.body.classList.toggle("keyboard-open", this.keyboardOpen);
    if (this.keyboardOpen) {
      if (this.isKeyboardInput(document.activeElement) && !this.isComposingItemName) {
        this.ensureFocusedFieldVisible();
      }
    } else {
      this.viewportMaxHeight = Math.max(this.viewportMaxHeight, viewport.height);
    }
    this.viewportLastHeight = viewport.height;
  }

  ensureFocusedFieldVisible() {
    if (this.isComposingItemName) return;
    const field = document.activeElement;
    if (!this.isKeyboardInput(field)) return;
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0;
    const bottom = top + (viewport?.height || window.innerHeight);
    const rect = field.getBoundingClientRect();
    if (rect.top < top + 16 || rect.bottom > bottom - 24) {
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  handleAddItem(event) {
    event.preventDefault();
    if (this.isComposingItemName) {
      this.pendingAddAfterComposition = true;
      return;
    }
    const selectedCategoryId = this.elements.itemCategory.value;
    const item = this.shoppingManager.add({
      name: this.elements.itemName.value,
      count: this.elements.itemCount.value,
      categoryId: selectedCategoryId,
    });
    if (!item) return;

    this.prepareContinuousAdd(selectedCategoryId);
    this.renderShoppingList();
  }

  handleItemCompositionStart() {
    this.isComposingItemName = true;
    this.elements.addItemPanel.open = true;
    window.clearTimeout(this.keyboardTimer);
  }

  handleItemCompositionEnd() {
    this.isComposingItemName = false;
    this.scheduleKeyboardStateUpdate();
    if (this.pendingAddAfterComposition) {
      this.pendingAddAfterComposition = false;
      queueMicrotask(() => this.elements.addItemForm.requestSubmit());
      return;
    }
    requestAnimationFrame(() => {
      this.ensureFocusedFieldVisible();
    });
  }

  prepareContinuousAdd(selectedCategoryId) {
    this.elements.itemName.value = "";
    this.elements.itemCount.value = 1;
    this.elements.itemCategory.value = selectedCategoryId;
    this.elements.addItemPanel.open = true;

    const restoreInput = () => {
      const active = document.activeElement;
      const canRestoreFocus = active === document.body
        || active === this.elements.addItemButton
        || active === this.elements.itemName;
      if (canRestoreFocus && active !== this.elements.itemName) {
        this.elements.itemName.focus({ preventScroll: true });
      }
      this.ensureFocusedFieldVisible();
    };

    restoreInput();
    requestAnimationFrame(restoreInput);
    window.setTimeout(restoreInput, 80);
  }

  adjustInputCount(amount) {
    const currentCount = Number(this.elements.itemCount.value) || 1;
    this.elements.itemCount.value = Math.max(1, currentCount + amount);
  }

  handleListAction(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    if (action === "purchase") {
      const itemId = Number(target.closest("[data-id]")?.dataset.id);
      target.disabled = true;
      const item = this.shoppingManager.purchase(itemId);
      if (item) {
        const key = item.name.toLocaleLowerCase("ja-JP");
        const previousPurchasedItem = this.purchasedManager
          .getAll()
          .find((current) => current.name.toLocaleLowerCase("ja-JP") === key);
        const record = this.purchasedManager.recordPurchase(item);
        this.pendingPurchaseUndo = record ? {
          item: { ...item },
          recordId: record.id,
          previousPurchasedItem: previousPurchasedItem ? { ...previousPurchasedItem } : null,
        } : null;
        this.renderShoppingList();
        this.renderPurchasedList();
        this.showToast(`${item.name}を購入履歴に記録しました`, { undo: Boolean(this.pendingPurchaseUndo), duration: 6000 });
      }
      return;
    }

    const itemId = Number(target.closest("[data-id]")?.dataset.id);
    if (!itemId) return;
    if (action === "increase") this.shoppingManager.changeCount(itemId, 1);
    if (action === "decrease") this.shoppingManager.changeCount(itemId, -1);
    if (action === "edit") this.openEditDialog(itemId);
    if (action === "delete" && confirm("本当に削除しますか？")) this.shoppingManager.delete(itemId);
    this.renderShoppingList();
  }

  handlePurchasedClick(event) {
    const recordRow = event.target.closest("[data-purchase-record-id]");
    if (recordRow && event.target.closest("[data-action='rebuy-record']")) {
      const record = this.purchasedManager
        .getPurchaseRecords()
        .find((item) => item.id === recordRow.dataset.purchaseRecordId);
      if (!record) return;
      this.shoppingManager.add({ name: record.name, count: 1, categoryId: record.categoryId });
      this.renderShoppingList();
      this.showToast(`${record.name}をリストに追加しました`);
      return;
    }

    const row = event.target.closest("[data-purchased-id]");
    if (!row) return;
    const purchasedItem = this.purchasedManager.getAll().find((item) => item.id === Number(row.dataset.purchasedId));
    if (!purchasedItem) return;

    if (event.target.closest("[data-action='add-purchased-to-list']")) {
      this.shoppingManager.add({ name: purchasedItem.name, count: 1, categoryId: purchasedItem.categoryId });
      this.renderShoppingList();
      this.showToast(`${purchasedItem.name}をリストに追加しました`);
      return;
    }

    if (event.target.closest("[data-action='delete-purchased']")) {
      if (!confirm(`${purchasedItem.name}を履歴から削除しますか？`)) return;
      this.purchasedManager.delete(purchasedItem.id);
      this.renderPurchasedList();
      this.showToast("履歴から削除しました");
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

  async handleCategoryClick(event) {
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
    this.purchasedManager.replaceCategory(id, fallback.id);
    if (this.receiptUI) await this.receiptUI.manager.replaceCategory(id, fallback.id);
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
    this.renderShoppingList();
    this.showToast("保存しました");
  }

  renderAll() {
    this.renderCategoryOptions();
    this.renderShoppingList();
    this.renderPurchasedList();
    this.renderCategories();
  }

  renderCategoryOptions() {
    const categories = this.categoryManager.getAll();
    const currentItemCategoryId = this.elements.itemCategory.value;
    const defaultCategory = categories.find((category) => category.name === "食料品") || categories[0];
    const selectedItemCategoryId = categories.some(
      (category) => String(category.id) === currentItemCategoryId
    )
      ? currentItemCategoryId
      : String(defaultCategory?.id ?? "");
    this.fillCategorySelect(this.elements.itemCategory, categories, selectedItemCategoryId);
    this.fillCategorySelect(this.elements.editCategory, categories);
    this.fillFilterSelect(this.elements.purchasedCategoryFilter, categories, this.purchasedCategoryId);
  }

  fillCategorySelect(selectElement, categories, selectedValue = "") {
    selectElement.innerHTML = categories
      .map((category) => `<option value="${category.id}">${this.escapeHtml(category.name)}</option>`)
      .join("");
    if (selectedValue) selectElement.value = selectedValue;
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

  createListItemHtml(item) {
    return this.createItemHtml(item, {
      leadingHtml: `
        <div class="cart-icon" aria-hidden="true">📝</div>
      `,
      actionsHtml: `
        <button class="small-button purchase-button" type="button" data-action="purchase" aria-label="${this.escapeHtml(item.name)}を購入済みにする">購入</button>
        <button class="small-button" type="button" data-action="edit">編集</button>
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

  renderPurchasedList() {
    const records = this.purchasedManager.getPurchaseRecords();
    this.elements.purchaseRecordCountSummary.textContent = `${records.length}件`;
    this.renderPurchaseRecordGroups(records);

    const items = this.purchasedManager
      .getAll()
      .filter((item) => item.name.toLocaleLowerCase("ja-JP").includes(this.purchasedSearch))
      .filter((item) => this.purchasedCategoryId === "all" || String(item.categoryId) === this.purchasedCategoryId);
    this.sortPurchasedItems(items);
    this.elements.purchasedCountSummary.textContent = `${items.length}件`;
    if (items.length === 0) {
      const message = this.purchasedSearch || this.purchasedCategoryId !== "all"
        ? "条件に合う商品はありません。"
        : "会計済みにした商品がここに蓄積されます。";
      this.elements.purchasedList.innerHTML = `<p class="empty-message">${message}</p>`;
      return;
    }
    this.elements.purchasedList.innerHTML = items.map((item) => this.createPurchasedItemHtml(item)).join("");
  }

  renderPurchaseRecordGroups(records) {
    if (records.length === 0) {
      this.elements.purchaseRecordList.innerHTML = `<p class="empty-message">次に「購入」を押した商品から、日付別に記録されます。</p>`;
      return;
    }

    const groups = new Map();
    records.forEach((record) => {
      const dateKey = this.localDateKey(record.purchasedAt);
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(record);
    });
    this.elements.purchaseRecordList.innerHTML = [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, items], index) => this.createPurchaseDateGroup(dateKey, items, index === 0))
      .join("");
  }

  createPurchaseDateGroup(dateKey, records, open) {
    const totalCount = records.reduce((sum, record) => sum + record.count, 0);
    return `
      <details class="history-day" ${open ? "open" : ""}>
        <summary>
          <span><strong>${this.formatDateHeader(dateKey)}</strong><small>${records.length}商品・合計${totalCount}点</small></span>
          <span class="chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="history-day-body">
          ${records.map((record) => this.createPurchaseRecordHtml(record)).join("")}
        </div>
      </details>`;
  }

  createPurchaseRecordHtml(record) {
    const category = this.categoryManager.findById(record.categoryId) || this.categoryManager.getFallback();
    return `
      <article class="purchase-record" data-purchase-record-id="${this.escapeHtml(record.id)}" style="--category-color:${this.escapeHtml(category.color)}">
        <div class="item-main">
          <p class="item-name">${this.escapeHtml(record.name)} ×${record.count}</p>
          <div class="item-meta">
            <span><span class="color-dot" style="background:${this.escapeHtml(category.color)}"></span>${this.escapeHtml(category.name)}</span>
            <span>${this.formatTime(record.purchasedAt)}</span>
          </div>
        </div>
        <button class="purchased-add-button" type="button" data-action="rebuy-record">もう一度買う</button>
      </article>`;
  }

  sortPurchasedItems(items) {
    const dateValue = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).getTime() : 0;
    const newestFirst = (a, b) => dateValue(b.lastPurchasedAt) - dateValue(a.lastPurchasedAt);
    if (this.purchasedSort === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name, "ja", { sensitivity: "base" }));
      return;
    }
    if (this.purchasedSort === "oldest") {
      items.sort((a, b) => dateValue(a.lastPurchasedAt) - dateValue(b.lastPurchasedAt));
      return;
    }
    if (this.purchasedSort === "frequent") {
      items.sort((a, b) => b.purchaseCount - a.purchaseCount || newestFirst(a, b));
      return;
    }
    items.sort(newestFirst);
  }

  createPurchasedItemHtml(item) {
    const category = this.categoryManager.findById(item.categoryId) || this.categoryManager.getFallback();
    return `
      <article class="purchased-item" data-purchased-id="${item.id}" style="--category-color:${this.escapeHtml(category.color)}">
        <div class="item-main">
          <p class="item-name">${this.escapeHtml(item.name)}</p>
          <div class="item-meta">
            <span><span class="color-dot" style="background:${this.escapeHtml(category.color)}"></span>${this.escapeHtml(category.name)}</span>
            <span>購入 ${item.purchaseCount}回</span>
            <span>${item.lastPurchasedAt ? `最終購入 ${this.formatPurchasedDate(item.lastPurchasedAt)}` : "購入日不明"}</span>
          </div>
        </div>
        <div class="purchased-actions">
          <button class="purchased-add-button" type="button" data-action="add-purchased-to-list">もう一度買う</button>
          <button class="purchased-delete-button" type="button" data-action="delete-purchased" aria-label="${this.escapeHtml(item.name)}を削除">削除</button>
        </div>
      </article>
    `;
  }

  formatPurchasedDate(value) {
    if (!value || Number.isNaN(new Date(value).getTime())) return "日付不明";
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(value)
    );
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
      ...this.purchasedManager.getAll().map((item) => ["purchased", item.id, item.name, item.purchaseCount, item.categoryId, "", item.lastPurchasedAt, "", ""]),
      ...this.purchasedManager.getPurchaseRecords().map((item) => ["purchaseRecord", item.id, item.name, item.count, item.categoryId, "", item.purchasedAt, "", "purchased"]),
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
    const imported = { shoppingItems: [], categories: [], purchasedItems: [], purchaseRecords: [] };
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
      if (type === "purchased" || (type === "history" && action === "purchased")) {
        imported.purchasedItems.push({
          id: numericId,
          name,
          purchaseCount: type === "purchased" ? Math.max(1, Number(count) || 1) : 1,
          categoryId: Number(categoryId),
          lastPurchasedAt: date || null,
        });
      }
      if (type === "purchaseRecord" && date) {
        imported.purchaseRecords.push({
          id: id || `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          sourceItemId: null,
          name,
          count: Math.max(1, Number(count) || 1),
          categoryId: Number(categoryId),
          purchasedAt: date,
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
    this.storage.set("purchasedItems", this.purchasedManager.mergeDuplicates(imported.purchasedItems));
    this.storage.set("purchaseRecords", this.purchasedManager.normalizeRecords(imported.purchaseRecords));
    event.target.value = "";
    this.renderAll();
    this.showToast("CSVを読み込みました");
  }

  async exportJson() {
    const localData = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(`${this.storage.namespace}:`)) {
        try { localData[key] = JSON.parse(localStorage.getItem(key)); } catch { localData[key] = localStorage.getItem(key); }
      }
    }
    const backup = {
      format: "okaimono-backup",
      version: 4,
      exportedAt: new Date().toISOString(),
      localStorage: localData,
      receiptData: this.receiptUI ? await this.receiptUI.exportData() : { receipts: [], mappings: [] },
    };
    this.downloadBlob(JSON.stringify(backup, null, 2), `okaimono-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    this.showToast("全データをJSON保存しました");
  }

  async prepareJsonImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.format !== "okaimono-backup" || !backup.localStorage || !backup.receiptData) throw new Error("形式が違います");
      const local = backup.localStorage;
      const shopping = local[`${this.storage.namespace}:shoppingItems`] || [];
      const purchased = local[`${this.storage.namespace}:purchasedItems`] || [];
      const purchaseRecords = local[`${this.storage.namespace}:purchaseRecords`] || [];
      const categories = local[`${this.storage.namespace}:categories`] || [];
      const receipts = backup.receiptData.receipts || [];
      this.elements.backupPreview.innerHTML = `<dl class="backup-summary"><dt>作成日時</dt><dd>${this.escapeHtml(this.formatDateTime(backup.exportedAt))}</dd><dt>買い物リスト</dt><dd>${shopping.length}件</dd><dt>日付付き購入記録</dt><dd>${purchaseRecords.length}件</dd><dt>購入商品</dt><dd>${purchased.length}件</dd><dt>カテゴリー</dt><dd>${categories.length}件</dd><dt>レシート</dt><dd>${receipts.length}件</dd><dt>商品名の学習</dt><dd>${(backup.receiptData.mappings || []).length}件</dd></dl>`;
      this.pendingBackup = backup;
      this.elements.backupPreviewDialog.showModal();
    } catch (error) {
      alert(`JSONを確認できませんでした: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  cancelJsonImport() {
    this.pendingBackup = null;
    this.elements.backupPreviewDialog.close();
  }

  async confirmJsonImport() {
    if (!this.pendingBackup) return;
    const backup = this.pendingBackup;
    this.storage.clearAppData();
    Object.entries(backup.localStorage).forEach(([key, value]) => {
      if (key.startsWith(`${this.storage.namespace}:`)) localStorage.setItem(key, JSON.stringify(value));
    });
    if (this.receiptUI) await this.receiptUI.importData(backup.receiptData);
    this.pendingBackup = null;
    this.elements.backupPreviewDialog.close();
    this.applyTheme(this.storage.get("darkMode", false));
    this.renderAll();
    this.showToast("JSONバックアップを復元しました");
  }

  downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async resetStorage() {
    if (!confirm("買い物・購入履歴・カテゴリ・設定・レシートをすべて削除しますか？この操作は元に戻せません。")) return;
    this.storage.clearAppData();
    if (this.receiptUI) await this.receiptUI.importData({ receipts: [], mappings: [] });
    this.applyTheme(false);
    this.renderAll();
    this.showToast("初期化しました");
  }

  undoLastPurchase() {
    const pending = this.pendingPurchaseUndo;
    if (!pending) return;
    this.pendingPurchaseUndo = null;
    const undoneRecord = this.purchasedManager.undoPurchase(pending.recordId, pending.previousPurchasedItem);
    if (!undoneRecord) {
      this.showToast("購入を元に戻せませんでした");
      return;
    }
    this.shoppingManager.restorePurchased(pending.item);
    this.renderShoppingList();
    this.renderPurchasedList();
    this.showToast(`${pending.item.name}の購入を元に戻しました`);
  }

  showToast(message, { undo = false, duration = 1600 } = {}) {
    window.clearTimeout(this.toastTimer);
    if (!undo) this.pendingPurchaseUndo = null;
    this.elements.toastMessage.textContent = message;
    this.elements.toastUndoButton.hidden = !undo;
    this.elements.toast.classList.add("visible");
    this.toastTimer = window.setTimeout(() => {
      this.elements.toast.classList.remove("visible");
      this.elements.toastUndoButton.hidden = true;
      if (undo) this.pendingPurchaseUndo = null;
    }, duration);
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

  localDateKey(value) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  formatDateHeader(dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).format(date);
  }
};
