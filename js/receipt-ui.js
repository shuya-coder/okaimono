window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.ReceiptUI = class ReceiptUI {
  constructor({ receiptManager, categoryManager, showToast }) {
    this.manager = receiptManager;
    this.categoryManager = categoryManager;
    this.showToast = showToast;
    this.currentItems = [];
    this.search = "";
    this.monthFilter = "all";
    this.elements = {};
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    const month = new Date().toISOString().slice(0, 7);
    this.elements.receiptMonth.value = month;
    await this.renderAll();
  }

  cacheElements() {
    const ids = ["receiptMonth", "monthlySpend", "receiptImageInput", "manualReceiptButton", "ocrProgress", "ocrProgressBar", "ocrProgressText", "receiptEditor", "receiptEditorTitle", "receiptReviewBadge", "receiptForm", "receiptId", "receiptStore", "receiptDate", "receiptDiscount", "receiptTax", "receiptTotal", "addReceiptItemButton", "receiptItemsEditor", "receiptDifferenceWarning", "receiptNotes", "receiptRawText", "cancelReceiptButton", "receiptRecordCount", "dailySpend", "storeSpend", "categorySpend", "priceHistoryProduct", "priceHistory", "receiptSearch", "receiptMonthFilter", "receiptList"];
    ids.forEach((id) => { this.elements[id] = document.querySelector(`#${id}`); });
  }

  bindEvents() {
    this.elements.receiptMonth.addEventListener("change", () => this.renderAll());
    this.elements.receiptImageInput.addEventListener("change", (event) => this.handleImage(event));
    this.elements.manualReceiptButton.addEventListener("click", () => this.openEditor(this.emptyReceipt()));
    this.elements.addReceiptItemButton.addEventListener("click", () => this.addItem());
    this.elements.receiptItemsEditor.addEventListener("input", (event) => this.updateItem(event));
    this.elements.receiptItemsEditor.addEventListener("change", (event) => this.updateItem(event));
    this.elements.receiptItemsEditor.addEventListener("click", (event) => this.removeItem(event));
    [this.elements.receiptDiscount, this.elements.receiptTax, this.elements.receiptTotal].forEach((element) => element.addEventListener("input", () => this.renderDifference()));
    this.elements.receiptForm.addEventListener("submit", (event) => this.saveReceipt(event));
    this.elements.cancelReceiptButton.addEventListener("click", () => this.closeEditor());
    this.elements.receiptSearch.addEventListener("input", (event) => { this.search = event.target.value.trim().toLocaleLowerCase("ja-JP"); this.renderReceiptList(); });
    this.elements.receiptMonthFilter.addEventListener("change", (event) => { this.monthFilter = event.target.value; this.renderReceiptList(); });
    this.elements.receiptList.addEventListener("click", (event) => this.handleReceiptAction(event));
    this.elements.priceHistoryProduct.addEventListener("change", () => this.renderPriceHistory());
  }

  emptyReceipt() {
    return { storeName: "", purchasedAt: new Date().toISOString(), items: [], discount: 0, tax: 0, total: 0, notes: "", rawText: "", needsReview: false };
  }

  async handleImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    this.elements.ocrProgress.hidden = false;
    this.elements.ocrProgressBar.value = 0;
    this.elements.ocrProgressText.textContent = "画像を補正しています…";
    try {
      const result = await this.manager.recognize(file, (progress) => {
        const value = Number(progress.progress) || 0;
        this.elements.ocrProgressBar.value = value;
        const labels = { "loading tesseract core": "OCR本体を準備中", "loading language traineddata": "日本語データを読込中", "initializing api": "解析を準備中", "recognizing text": "文字を解析中" };
        this.elements.ocrProgressText.textContent = `${labels[progress.status] || progress.status || "解析中"} ${Math.round(value * 100)}%`;
      });
      this.openEditor(result);
      this.showToast("解析結果を確認して保存してください");
    } catch (error) {
      console.error(error);
      alert("レシートを読み取れませんでした。手入力画面を開きます。");
      this.openEditor(this.emptyReceipt());
    } finally {
      event.target.value = "";
      this.elements.ocrProgress.hidden = true;
    }
  }

  openEditor(receipt) {
    this.elements.receiptId.value = receipt.id || "";
    this.elements.receiptEditorTitle.textContent = receipt.id ? "レシートを編集" : "レシート内容の確認";
    this.elements.receiptStore.value = receipt.storeName || "";
    this.elements.receiptDate.value = this.toLocalDateTime(receipt.purchasedAt);
    this.elements.receiptDiscount.value = Number(receipt.discount) || 0;
    this.elements.receiptTax.value = Number(receipt.tax) || 0;
    this.elements.receiptTotal.value = Number(receipt.total) || 0;
    this.elements.receiptNotes.value = receipt.notes || "";
    this.elements.receiptRawText.textContent = receipt.rawText || "手入力のためOCR原文はありません。";
    this.elements.receiptReviewBadge.hidden = !receipt.needsReview;
    this.currentItems = (receipt.items || []).map((item) => ({ ...item }));
    if (this.currentItems.length === 0) this.addItem(false);
    this.renderItemEditor();
    this.renderDifference();
    this.elements.receiptEditor.hidden = false;
    this.elements.receiptEditor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  closeEditor() {
    this.elements.receiptEditor.hidden = true;
    this.currentItems = [];
  }

  addItem(render = true) {
    this.currentItems.push({ id: this.manager.createId(), rawName: "", name: "", quantity: 1, unitPrice: 0, amount: 0, categoryId: this.categoryManager.getFallback().id, uncertain: false });
    if (render) this.renderItemEditor();
  }

  renderItemEditor() {
    const categories = this.categoryManager.getAll();
    this.elements.receiptItemsEditor.innerHTML = this.currentItems.map((item, index) => `
      <div class="receipt-item-editor" data-index="${index}">
        <label class="receipt-item-name">商品名<input data-field="name" type="text" value="${this.escapeHtml(item.name)}" required></label>
        <label>数量<input data-field="quantity" type="number" min="0.01" step="0.01" value="${item.quantity}"></label>
        <label>単価<input data-field="unitPrice" type="number" min="0" step="1" value="${item.unitPrice}"></label>
        <label>金額<input data-field="amount" type="number" min="0" step="1" value="${item.amount}"></label>
        <label class="receipt-item-category">カテゴリ<select data-field="categoryId">${categories.map((category) => `<option value="${category.id}" ${category.id === Number(item.categoryId) ? "selected" : ""}>${this.escapeHtml(category.name)}</option>`).join("")}</select></label>
        <label class="uncertain-toggle"><input data-field="uncertain" type="checkbox" ${item.uncertain ? "checked" : ""}>要確認</label>
        <button class="small-button danger" type="button" data-action="remove-receipt-item">削除</button>
      </div>`).join("");
    this.renderDifference();
  }

  updateItem(event) {
    const row = event.target.closest("[data-index]");
    if (!row) return;
    const item = this.currentItems[Number(row.dataset.index)];
    const field = event.target.dataset.field;
    if (!item || !field) return;
    if (field === "uncertain") item[field] = event.target.checked;
    else if (["quantity", "unitPrice", "amount", "categoryId"].includes(field)) item[field] = Number(event.target.value) || 0;
    else item[field] = event.target.value;
    if (field === "quantity" || field === "unitPrice") {
      item.amount = Math.round(item.quantity * item.unitPrice);
      row.querySelector("[data-field='amount']").value = item.amount;
    }
    this.renderDifference();
  }

  removeItem(event) {
    const button = event.target.closest("[data-action='remove-receipt-item']");
    if (!button) return;
    const index = Number(button.closest("[data-index]").dataset.index);
    this.currentItems.splice(index, 1);
    if (this.currentItems.length === 0) this.addItem(false);
    this.renderItemEditor();
  }

  renderDifference() {
    const itemTotal = this.currentItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const calculated = itemTotal - (Number(this.elements.receiptDiscount.value) || 0) + (Number(this.elements.receiptTax.value) || 0);
    const receiptTotal = Number(this.elements.receiptTotal.value) || 0;
    const difference = receiptTotal - calculated;
    this.elements.receiptDifferenceWarning.hidden = Math.abs(difference) < 1;
    this.elements.receiptDifferenceWarning.textContent = `明細計算 ¥${this.formatMoney(calculated)} と確認済み合計の差額は ¥${this.formatMoney(difference)} です。確認後、そのまま保存できます。`;
  }

  async saveReceipt(event) {
    event.preventDefault();
    const existingId = this.elements.receiptId.value;
    const existing = existingId ? await this.manager.db.getReceipt(existingId) : null;
    const result = await this.manager.save({
      ...existing,
      id: existingId || undefined,
      storeName: this.elements.receiptStore.value,
      purchasedAt: new Date(this.elements.receiptDate.value).toISOString(),
      items: this.currentItems,
      discount: this.elements.receiptDiscount.value,
      tax: this.elements.receiptTax.value,
      total: this.elements.receiptTotal.value,
      notes: this.elements.receiptNotes.value,
      rawText: this.elements.receiptRawText.textContent.startsWith("手入力") ? "" : this.elements.receiptRawText.textContent,
      needsReview: this.currentItems.some((item) => item.uncertain),
    });
    this.closeEditor();
    await this.renderAll();
    if (result.duplicate) alert(`同じレシートの可能性があります。\n${result.duplicate.storeName} / ${this.formatDate(result.duplicate.purchasedAt)} / ¥${this.formatMoney(result.duplicate.total)}\n両方とも保存されています。不要な方を削除してください。`);
    this.showToast("レシートを保存しました");
  }

  async handleReceiptAction(event) {
    const row = event.target.closest("[data-receipt-id]");
    if (!row) return;
    const id = row.dataset.receiptId;
    if (event.target.closest("[data-action='edit-receipt']")) {
      const receipt = await this.manager.db.getReceipt(id);
      if (receipt) this.openEditor(receipt);
    }
    if (event.target.closest("[data-action='delete-receipt']")) {
      if (!confirm("このレシート記録を削除しますか？買い物リストや購入履歴には影響しません。")) return;
      await this.manager.db.deleteReceipt(id);
      await this.renderAll();
      this.showToast("レシートを削除しました");
    }
  }

  async renderAll() {
    this.receipts = await this.manager.getAll();
    this.renderMonthOptions();
    this.renderSummary();
    this.renderReceiptList();
    this.renderProductOptions();
    this.renderPriceHistory();
  }

  renderMonthOptions() {
    const months = [...new Set(this.receipts.map((receipt) => receipt.purchasedAt.slice(0, 7)))].sort().reverse();
    const value = this.elements.receiptMonthFilter.value || this.monthFilter;
    this.elements.receiptMonthFilter.innerHTML = `<option value="all">すべて</option>${months.map((month) => `<option value="${month}">${this.escapeHtml(month)}</option>`).join("")}`;
    this.elements.receiptMonthFilter.value = months.includes(value) ? value : "all";
    this.monthFilter = this.elements.receiptMonthFilter.value;
  }

  renderSummary() {
    const month = this.elements.receiptMonth.value || new Date().toISOString().slice(0, 7);
    const receipts = this.receipts.filter((receipt) => receipt.purchasedAt.startsWith(month));
    this.elements.monthlySpend.textContent = `¥${this.formatMoney(receipts.reduce((sum, receipt) => sum + receipt.total, 0))}`;
    this.elements.receiptRecordCount.textContent = `${receipts.length}件`;
    this.renderGroupedSummary(this.elements.dailySpend, receipts, (receipt) => receipt.purchasedAt.slice(5, 10).replace("-", "/"));
    this.renderGroupedSummary(this.elements.storeSpend, receipts, (receipt) => receipt.storeName || "店舗不明");
    const categoryTotals = new Map();
    receipts.flatMap((receipt) => receipt.items).forEach((item) => categoryTotals.set(item.categoryId, (categoryTotals.get(item.categoryId) || 0) + item.amount));
    const categoryRows = [...categoryTotals.entries()].map(([id, amount]) => ({ label: this.categoryManager.findById(id)?.name || "未分類", amount }));
    this.elements.categorySpend.innerHTML = this.summaryRows(categoryRows);
  }

  renderGroupedSummary(element, receipts, keyOf) {
    const totals = new Map();
    receipts.forEach((receipt) => totals.set(keyOf(receipt), (totals.get(keyOf(receipt)) || 0) + receipt.total));
    element.innerHTML = this.summaryRows([...totals.entries()].map(([label, amount]) => ({ label, amount })));
  }

  summaryRows(rows) {
    if (!rows.length) return `<p class="empty-inline">データなし</p>`;
    return rows.sort((a, b) => b.amount - a.amount).slice(0, 8).map((row) => `<div><span>${this.escapeHtml(row.label)}</span><strong>¥${this.formatMoney(row.amount)}</strong></div>`).join("");
  }

  renderReceiptList() {
    const filtered = (this.receipts || []).filter((receipt) => {
      const searchable = `${receipt.storeName} ${receipt.items.map((item) => item.name).join(" ")}`.toLocaleLowerCase("ja-JP");
      return searchable.includes(this.search) && (this.monthFilter === "all" || receipt.purchasedAt.startsWith(this.monthFilter));
    });
    if (!filtered.length) { this.elements.receiptList.innerHTML = `<p class="empty-message">レシート記録はありません。</p>`; return; }
    this.elements.receiptList.innerHTML = filtered.map((receipt) => `<article class="receipt-record" data-receipt-id="${receipt.id}"><div><p class="item-name">${this.escapeHtml(receipt.storeName)}</p><p class="item-meta">${this.formatDate(receipt.purchasedAt)}・${receipt.items.length}商品${receipt.needsReview ? "・要確認" : ""}</p></div><strong>¥${this.formatMoney(receipt.total)}</strong><div class="receipt-record-actions"><button class="small-button" type="button" data-action="edit-receipt">編集</button><button class="small-button danger" type="button" data-action="delete-receipt">削除</button></div></article>`).join("");
  }

  renderProductOptions() {
    const names = [...new Set((this.receipts || []).flatMap((receipt) => receipt.items.map((item) => item.name)))].sort((a, b) => a.localeCompare(b, "ja"));
    const current = this.elements.priceHistoryProduct.value;
    this.elements.priceHistoryProduct.innerHTML = `<option value="">商品を選択</option>${names.map((name) => `<option value="${this.escapeHtml(name)}">${this.escapeHtml(name)}</option>`).join("")}`;
    if (names.includes(current)) this.elements.priceHistoryProduct.value = current;
  }

  renderPriceHistory() {
    const name = this.elements.priceHistoryProduct.value;
    if (!name) { this.elements.priceHistory.innerHTML = `<p class="empty-inline">商品を選ぶと価格推移を表示します。</p>`; return; }
    const points = (this.receipts || []).flatMap((receipt) => receipt.items.filter((item) => item.name === name).map((item) => ({ date: receipt.purchasedAt, store: receipt.storeName, price: item.unitPrice || item.amount / item.quantity }))).sort((a, b) => new Date(a.date) - new Date(b.date));
    const previous = points.at(-2);
    const latest = points.at(-1);
    const change = previous && latest ? latest.price - previous.price : null;
    const comparison = change === null ? "比較データなし" : change === 0 ? "前回と同じ" : `${change > 0 ? "値上がり" : "値下がり"} ¥${this.formatMoney(Math.abs(change))}`;
    this.elements.priceHistory.innerHTML = `<p class="price-comparison">${comparison}</p>${points.map((point) => `<div><span>${this.formatDate(point.date)} ${this.escapeHtml(point.store)}</span><strong>¥${this.formatMoney(point.price)}</strong></div>`).join("")}`;
  }

  async exportData() {
    return { receipts: await this.manager.getAll(), mappings: await this.manager.db.getAllMappings() };
  }

  async importData(data) {
    await this.manager.db.replaceAll({ receipts: Array.isArray(data?.receipts) ? data.receipts : [], mappings: Array.isArray(data?.mappings) ? data.mappings : [] });
    await this.renderAll();
  }

  toLocalDateTime(value) {
    const date = new Date(value || Date.now());
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  formatDate(value) { return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)); }
  formatMoney(value) { return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(Number(value) || 0); }
  escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
};
