window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.ReceiptUI = class ReceiptUI {
  constructor({ receiptManager, categoryManager, showToast }) {
    this.manager = receiptManager;
    this.categoryManager = categoryManager;
    this.showToast = showToast;
    this.currentItems = [];
    this.currentReceiptMeta = {};
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
    const ids = ["receiptMonth", "monthlySpend", "copyChatGptPromptButton", "chatGptReceiptJson", "importChatGptJsonButton", "chatGptImportError", "manualReceiptButton", "receiptEditor", "receiptEditorTitle", "receiptReviewBadge", "receiptForm", "receiptId", "receiptStore", "receiptDate", "receiptSubtotal", "receiptDiscount", "receiptIncludedTax", "receiptTax", "receiptTotal", "addReceiptItemButton", "receiptItemsEditor", "receiptDifferenceWarning", "receiptNotes", "receiptRawText", "cancelReceiptButton", "receiptRecordCount", "dailySpend", "storeSpend", "categorySpend", "priceHistoryProduct", "priceHistory", "receiptSearch", "receiptMonthFilter", "receiptList"];
    ids.forEach((id) => { this.elements[id] = document.querySelector(`#${id}`); });
  }

  bindEvents() {
    this.elements.receiptMonth.addEventListener("change", () => this.renderAll());
    this.elements.copyChatGptPromptButton.addEventListener("click", () => this.copyChatGptPrompt());
    this.elements.importChatGptJsonButton.addEventListener("click", () => this.importChatGptJson());
    this.elements.manualReceiptButton.addEventListener("click", () => this.openEditor(this.emptyReceipt()));
    this.elements.addReceiptItemButton.addEventListener("click", () => this.addItem());
    this.elements.receiptItemsEditor.addEventListener("input", (event) => this.updateItem(event));
    this.elements.receiptItemsEditor.addEventListener("change", (event) => this.updateItem(event));
    this.elements.receiptItemsEditor.addEventListener("click", (event) => this.removeItem(event));
    [this.elements.receiptSubtotal, this.elements.receiptDiscount, this.elements.receiptIncludedTax, this.elements.receiptTax, this.elements.receiptTotal].forEach((element) => element.addEventListener("input", () => this.renderDifference()));
    this.elements.receiptForm.addEventListener("submit", (event) => this.saveReceipt(event));
    this.elements.cancelReceiptButton.addEventListener("click", () => this.closeEditor());
    this.elements.receiptSearch.addEventListener("input", (event) => { this.search = event.target.value.trim().toLocaleLowerCase("ja-JP"); this.renderReceiptList(); });
    this.elements.receiptMonthFilter.addEventListener("change", (event) => { this.monthFilter = event.target.value; this.renderReceiptList(); });
    this.elements.receiptList.addEventListener("click", (event) => this.handleReceiptAction(event));
    this.elements.priceHistoryProduct.addEventListener("change", () => this.renderPriceHistory());
  }

  emptyReceipt() {
    return { storeName: "", purchasedAt: new Date().toISOString(), items: [], discount: 0, tax: 0, includedTax: 0, subtotal: null, deposit: null, total: 0, notes: "", rawText: "", source: "manual", needsReview: false };
  }

  async copyChatGptPrompt() {
    const prompt = this.manager.getChatGptPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = prompt;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      const copied = document.execCommand("copy");
      helper.remove();
      if (!copied) throw new Error("コピーできませんでした");
    }
    this.showToast("ChatGPT用の解析指示をコピーしました");
  }

  async importChatGptJson() {
    this.elements.chatGptImportError.hidden = true;
    this.elements.chatGptImportError.textContent = "";
    try {
      const result = await this.manager.importChatGptJson(this.elements.chatGptReceiptJson.value);
      this.openEditor(result);
      this.elements.chatGptReceiptJson.value = "";
      this.showToast("解析結果を確認して保存してください");
    } catch (error) {
      this.elements.chatGptImportError.textContent = error.message || "JSONを読み込めませんでした。";
      this.elements.chatGptImportError.hidden = false;
    }
  }

  openEditor(receipt) {
    this.elements.receiptId.value = receipt.id || "";
    this.elements.receiptEditorTitle.textContent = receipt.id ? "レシートを編集" : "レシート内容の確認";
    this.elements.receiptStore.value = receipt.storeName || "";
    this.elements.receiptDate.value = this.toLocalDateTime(receipt.purchasedAt);
    this.elements.receiptSubtotal.value = this.inputNumber(receipt.subtotal);
    this.elements.receiptDiscount.value = this.inputNumber(receipt.discount);
    this.elements.receiptIncludedTax.value = this.inputNumber(receipt.includedTax);
    this.elements.receiptTax.value = this.inputNumber(receipt.tax);
    this.elements.receiptTotal.value = this.inputNumber(receipt.total);
    this.elements.receiptNotes.value = receipt.notes || "";
    this.elements.receiptRawText.textContent = receipt.rawText || "手入力のため解析元JSONはありません。";
    this.elements.receiptReviewBadge.hidden = !receipt.needsReview;
    this.currentReceiptMeta = {
      includedTax: Number(receipt.includedTax) || 0,
      subtotal: this.numberOrNull(receipt.subtotal),
      deposit: this.numberOrNull(receipt.deposit),
      source: receipt.source || "manual",
    };
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
    this.currentReceiptMeta = {};
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
        <label>数量<input data-field="quantity" type="number" min="0.01" step="0.01" value="${this.inputNumber(item.quantity)}"></label>
        <label>単価<input data-field="unitPrice" type="number" min="0" step="1" value="${this.inputNumber(item.unitPrice)}"></label>
        <label>金額<input data-field="amount" type="number" min="0" step="1" value="${this.inputNumber(item.amount)}"></label>
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
    else if (field === "categoryId") item[field] = Number(event.target.value);
    else if (["quantity", "unitPrice", "amount"].includes(field)) item[field] = this.numberOrNull(event.target.value);
    else item[field] = event.target.value;
    if ((field === "quantity" || field === "unitPrice") && item.quantity !== null && item.unitPrice !== null) {
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
    const amounts = this.currentItems.map((item) => this.numberOrNull(item.amount));
    const hasAllAmounts = amounts.every((value) => value !== null);
    const itemTotal = hasAllAmounts ? amounts.reduce((sum, value) => sum + value, 0) : null;
    const discount = this.numberOrNull(this.elements.receiptDiscount.value) ?? 0;
    const subtotal = this.numberOrNull(this.elements.receiptSubtotal.value);
    const externalTax = this.numberOrNull(this.elements.receiptTax.value) ?? 0;
    const total = this.numberOrNull(this.elements.receiptTotal.value);
    const messages = [];
    if (itemTotal === null) messages.push("金額が未入力の商品があるため、商品明細の検算は完了していません。");
    if (itemTotal !== null && subtotal !== null) {
      const matchesBeforeDiscount = Math.abs(itemTotal - subtotal) < 1;
      const matchesAfterDiscount = Math.abs(itemTotal - discount - subtotal) < 1;
      if (!matchesBeforeDiscount && !matchesAfterDiscount) messages.push(`商品明細 ¥${this.formatMoney(itemTotal)}・値引き ¥${this.formatMoney(discount)} と小計 ¥${this.formatMoney(subtotal)} の関係を確認できません。`);
    }
    if (total === null) messages.push("支払合計が未入力のため、合計の検算は完了していません。");
    else {
      const candidates = subtotal === null ? (itemTotal === null ? [] : [itemTotal - discount + externalTax]) : [subtotal + externalTax, subtotal - discount + externalTax];
      if (!candidates.length) messages.push("小計または商品金額が未入力のため、合計の検算は完了していません。");
      else if (!candidates.some((value) => Math.abs(value - total) < 1)) messages.push(`小計・値引き・外税から支払合計 ¥${this.formatMoney(total)} を確認できません。内税は加算していません。`);
    }
    this.elements.receiptDifferenceWarning.hidden = messages.length === 0;
    this.elements.receiptDifferenceWarning.textContent = `${messages.join(" ")} 確認後、そのまま保存できます。`;
  }

  async saveReceipt(event) {
    event.preventDefault();
    const existingId = this.elements.receiptId.value;
    const existing = existingId ? await this.manager.db.getReceipt(existingId) : null;
    const result = await this.manager.save({
      ...existing,
      ...this.currentReceiptMeta,
      id: existingId || undefined,
      storeName: this.elements.receiptStore.value,
      purchasedAt: new Date(this.elements.receiptDate.value).toISOString(),
      items: this.currentItems,
      subtotal: this.numberOrNull(this.elements.receiptSubtotal.value),
      discount: this.elements.receiptDiscount.value,
      includedTax: this.numberOrNull(this.elements.receiptIncludedTax.value),
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
    const groups = new Map();
    filtered.forEach((receipt) => {
      const dateKey = this.localDateKey(receipt.purchasedAt);
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(receipt);
    });
    this.elements.receiptList.innerHTML = [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, receipts], index) => {
        const dailyTotal = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
        return `
          <details class="history-day receipt-day" ${index === 0 ? "open" : ""}>
            <summary>
              <span><strong>${this.formatDateHeader(dateKey)}</strong><small>${receipts.length}件・合計 ¥${this.formatMoney(dailyTotal)}</small></span>
              <span class="chevron" aria-hidden="true">⌄</span>
            </summary>
            <div class="history-day-body">
              ${receipts.map((receipt) => this.createReceiptHistoryHtml(receipt)).join("")}
            </div>
          </details>`;
      })
      .join("");
  }

  createReceiptHistoryHtml(receipt) {
    return `
      <details class="receipt-history-entry" data-receipt-id="${receipt.id}">
        <summary>
          <span><strong>${this.escapeHtml(receipt.storeName)}</strong><small>${this.formatTime(receipt.purchasedAt)}・${receipt.items.length}商品${receipt.needsReview ? "・要確認" : ""}</small></span>
          <strong>¥${this.formatMoney(receipt.total)}</strong>
        </summary>
        <div class="receipt-history-body">
          <div class="receipt-history-items">
            ${receipt.items.map((item) => `<div><span>${this.escapeHtml(item.name)} ×${item.quantity ?? "要確認"}</span><strong>${item.amount === null || item.amount === undefined ? "要確認" : `¥${this.formatMoney(item.amount)}`}</strong></div>`).join("") || `<p class="empty-inline">商品明細なし</p>`}
          </div>
          <div class="receipt-record-actions"><button class="small-button" type="button" data-action="edit-receipt">編集</button><button class="small-button danger" type="button" data-action="delete-receipt">削除</button></div>
        </div>
      </details>`;
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
    const points = (this.receipts || []).flatMap((receipt) => receipt.items.filter((item) => item.name === name).map((item) => ({ date: receipt.purchasedAt, store: receipt.storeName, price: item.unitPrice ?? (item.amount !== null && item.quantity ? item.amount / item.quantity : null) })).filter((point) => Number.isFinite(point.price))).sort((a, b) => new Date(a.date) - new Date(b.date));
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
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  inputNumber(value) { return value === null || value === undefined || value === "" ? "" : String(value); }
  numberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  localDateKey(value) {
    const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  formatDateHeader(dateKey) { return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${dateKey}T00:00:00`)); }
  formatTime(value) { return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
  formatDate(value) { return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value)); }
  formatMoney(value) { return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(Number(value) || 0); }
  escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
};
