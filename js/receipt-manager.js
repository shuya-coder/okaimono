window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.ReceiptManager = class ReceiptManager {
  constructor(db, categoryManager) {
    this.db = db;
    this.categoryManager = categoryManager;
  }

  async getAll() {
    const receipts = await this.db.getAllReceipts();
    return receipts.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
  }

  async save(receipt) {
    const normalized = this.normalizeReceipt(receipt);
    const all = await this.getAll();
    const duplicate = all.find((item) => item.id !== normalized.id && item.fingerprint === normalized.fingerprint);
    await this.db.saveReceipt(normalized);
    await this.learnMappings(normalized.items);
    return { receipt: normalized, duplicate };
  }

  normalizeReceipt(receipt) {
    const items = (receipt.items || []).filter((item) => String(item.name || "").trim()).map((item) => ({
      id: item.id || this.createId(),
      rawName: String(item.rawName || item.name).trim(),
      name: String(item.name).trim(),
      quantity: this.nullableNumber(item.quantity, 0.01),
      unitPrice: this.nullableNumber(item.unitPrice, 0),
      amount: this.nullableNumber(item.amount, 0),
      categoryId: Number(item.categoryId) || this.categoryManager.getFallback().id,
      uncertain: Boolean(item.uncertain),
    }));
    const normalized = {
      id: receipt.id || this.createId(),
      storeName: String(receipt.storeName || "店舗不明").trim(),
      purchasedAt: receipt.purchasedAt || new Date().toISOString(),
      items,
      discount: this.nullableNumber(receipt.discount, 0),
      tax: this.nullableNumber(receipt.tax, 0),
      includedTax: this.nullableNumber(receipt.includedTax, 0),
      subtotal: this.nullableNumber(receipt.subtotal, 0),
      deposit: this.nullableNumber(receipt.deposit, 0),
      total: this.nullableNumber(receipt.total, 0),
      notes: String(receipt.notes || ""),
      rawText: String(receipt.rawText || ""),
      source: receipt.source === "chatgpt-json" ? "chatgpt-json" : String(receipt.source || "manual"),
      needsReview: Boolean(receipt.needsReview || items.some((item) => item.uncertain)),
      createdAt: receipt.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    normalized.fingerprint = this.fingerprint(normalized);
    return normalized;
  }

  fingerprint(receipt) {
    const date = String(receipt.purchasedAt).slice(0, 16);
    const store = this.normalizeName(receipt.storeName);
    return `${date}|${store}|${Math.round(Number(receipt.total) || 0)}`;
  }

  async learnMappings(items) {
    for (const item of items) {
      const alias = this.normalizeName(item.rawName);
      const canonical = this.normalizeName(item.name);
      if (!alias || !canonical) continue;
      await this.db.saveMapping({ alias, canonicalName: item.name, categoryId: item.categoryId, updatedAt: new Date().toISOString() });
    }
  }

  async applyLearnedMapping(rawName) {
    const alias = this.normalizeName(rawName);
    const mappings = await this.db.getAllMappings();
    const exact = mappings.find((mapping) => mapping.alias === alias);
    if (exact) return { ...exact, learned: true };
    return { canonicalName: rawName.trim(), categoryId: this.guessCategory(rawName), learned: false };
  }

  async replaceCategory(oldCategoryId, newCategoryId) {
    const receipts = await this.getAll();
    for (const receipt of receipts) {
      let changed = false;
      receipt.items = receipt.items.map((item) => {
        if (Number(item.categoryId) !== Number(oldCategoryId)) return item;
        changed = true;
        return { ...item, categoryId: Number(newCategoryId) };
      });
      if (changed) await this.db.saveReceipt(receipt);
    }
    const mappings = await this.db.getAllMappings();
    for (const mapping of mappings) {
      if (Number(mapping.categoryId) === Number(oldCategoryId)) await this.db.saveMapping({ ...mapping, categoryId: Number(newCategoryId) });
    }
    if (this.ui) await this.ui.renderAll();
  }

  guessCategory(name) {
    const text = String(name).toLowerCase();
    const categories = this.categoryManager.getAll();
    const food = categories.find((category) => category.name === "食料品");
    const daily = categories.find((category) => category.name === "日用品");
    const foodWords = ["牛乳", "肉", "魚", "卵", "米", "パン", "野菜", "果物", "豆腐", "麺", "菓子", "飲料", "茶", "コーヒー"];
    const dailyWords = ["洗剤", "ティッシュ", "紙", "シャンプー", "石鹸", "歯磨", "袋", "電池", "掃除"];
    if (food && foodWords.some((word) => text.includes(word))) return food.id;
    if (daily && dailyWords.some((word) => text.includes(word))) return daily.id;
    return categories.find((category) => category.name === "未分類")?.id || this.categoryManager.getFallback().id;
  }

  normalizeName(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/g, " ").trim();
  }

  getChatGptSchema() {
    const categories = this.categoryManager.getAll().map((category) => category.name);
    const nullableMoney = { type: ["number", "null"], minimum: 0, maximum: 1000000000 };
    return {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "okaimono-receipt-v1",
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "storeName", "purchasedAt", "items", "subtotal", "discount", "includedTax", "externalTax", "total"],
      properties: {
        schemaVersion: { const: "okaimono-receipt-v1" },
        storeName: { type: ["string", "null"], maxLength: 200 },
        purchasedAt: { type: ["string", "null"], format: "date-time" },
        items: {
          type: "array",
          maxItems: 500,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "quantity", "unitPrice", "amount", "category"],
            properties: {
              name: { type: ["string", "null"], maxLength: 200 },
              quantity: { type: ["number", "null"], exclusiveMinimum: 0, maximum: 100000 },
              unitPrice: nullableMoney,
              amount: nullableMoney,
              category: { type: "string", enum: categories },
              uncertainFields: { type: "array", maxItems: 100, items: { type: "string", enum: ["name", "quantity", "unitPrice", "amount", "category"] } },
            },
          },
        },
        subtotal: nullableMoney,
        discount: nullableMoney,
        includedTax: nullableMoney,
        externalTax: nullableMoney,
        total: nullableMoney,
        uncertainFields: { type: "array", maxItems: 100, items: { type: "string", enum: ["storeName", "purchasedAt", "subtotal", "discount", "includedTax", "externalTax", "total"] } },
        notes: { type: ["string", "null"], maxLength: 5000 },
      },
    };
  }

  getChatGptPrompt() {
    const categories = this.categoryManager.getAll().map((category) => category.name);
    const schema = this.getChatGptSchema();
    return `添付したレシート写真を読み取り、次のJSONスキーマに厳密に従って出力してください。\n\n${JSON.stringify(schema, null, 2)}\n\nルール:\n- Markdownのコードブロックや説明文を付けず、JSONオブジェクトだけを出力する。\n- 写真から確認できない値はnullにし、推測した数値を確定値として書かない。\n- 金額は円単位の数値とし、通貨記号やカンマを含めない。値引額discountは正の数値で記録する。\n- subtotalはレシートに印字された小計または商品合計をそのまま記録し、値引きを独自に足し引きして作らない。\n- includedTaxは小計や商品金額に含まれる内税で、合計計算時に加算しない。\n- externalTaxは別途加算される外税で、合計計算時に一度だけ扱う。\n- 商品ごとのamountはその商品の数量分を含む商品別金額とする。\n- 不確かな項目名をuncertainFieldsへ入れる。\n- カテゴリは次のいずれかを使う: ${categories.join("、")}。判断できない場合は「未分類」にする。\n- 商品ではない小計、値引き、税額、合計、預り金、釣銭をitemsへ入れない。\n- 日時は日本時間のISO 8601形式で記録する。`;
  }

  async importChatGptJson(input) {
    const source = String(input || "").trim();
    if (!source) throw new Error("ChatGPTの解析結果を貼り付けてください。");
    if (source.length > 500000) throw new Error("JSONが大きすぎます。50万文字以内にしてください。");
    const jsonText = this.unwrapJsonFence(source);
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch {
      throw new Error("JSONの形式が正しくありません。ChatGPTの回答全体ではなくJSONだけを貼り付けてください。");
    }
    this.validateChatGptReceipt(data);

    const warnings = [];
    const items = [];
    for (const item of data.items) {
      const rawName = typeof item.name === "string" ? item.name.trim() : "";
      const mapping = rawName ? await this.applyLearnedMapping(rawName) : null;
      const categoryId = mapping?.learned ? mapping.categoryId : this.resolveCategoryId(item.category);
      const uncertainFields = item.uncertainFields || [];
      items.push({
        id: this.createId(),
        rawName,
        name: mapping?.canonicalName || rawName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        categoryId,
        uncertain: !rawName || item.quantity === null || item.unitPrice === null || item.amount === null || item.category === "未分類" || uncertainFields.length > 0,
      });
    }

    const imported = {
      storeName: data.storeName?.trim() || "",
      purchasedAt: data.purchasedAt ? new Date(data.purchasedAt).toISOString() : null,
      items,
      subtotal: data.subtotal,
      discount: data.discount,
      includedTax: data.includedTax,
      tax: data.externalTax,
      deposit: null,
      total: data.total,
      notes: data.notes || "",
      rawText: JSON.stringify(data, null, 2),
      source: "chatgpt-json",
      needsReview: false,
    };
    if (!imported.storeName) warnings.push("店舗名が不明です");
    if (!imported.purchasedAt) warnings.push("購入日時が不明です");
    if (items.length === 0) warnings.push("商品明細がありません");
    if ((data.uncertainFields || []).length > 0) warnings.push(`要確認: ${data.uncertainFields.join("、")}`);
    warnings.push(...this.getReconciliationWarnings(imported));
    if (warnings.length) imported.notes = [imported.notes, `取り込み時の確認:\n${warnings.join("\n")}`].filter(Boolean).join("\n\n");
    imported.needsReview = warnings.length > 0 || items.some((item) => item.uncertain);
    return imported;
  }

  validateChatGptReceipt(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("JSONの最上位はオブジェクトにしてください。");
    const topKeys = ["schemaVersion", "storeName", "purchasedAt", "items", "subtotal", "discount", "includedTax", "externalTax", "total", "uncertainFields", "notes"];
    this.assertAllowedKeys(data, topKeys, "最上位");
    if (data.schemaVersion !== "okaimono-receipt-v1") throw new Error("対応していないJSONスキーマです。解析指示をコピーし直してください。");
    ["storeName", "purchasedAt", "subtotal", "discount", "includedTax", "externalTax", "total"].forEach((key) => {
      if (!(key in data)) throw new Error(`${key}がありません。不明な場合はnullにしてください。`);
    });
    this.assertNullableString(data.storeName, "storeName", 200);
    this.assertNullableString(data.notes, "notes", 5000);
    if (data.purchasedAt !== null && (typeof data.purchasedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(data.purchasedAt) || Number.isNaN(Date.parse(data.purchasedAt)))) {
      throw new Error("purchasedAtはタイムゾーン付きISO 8601形式またはnullにしてください。");
    }
    ["subtotal", "discount", "includedTax", "externalTax", "total"].forEach((key) => this.assertNullableNumber(data[key], key, 0, 1000000000));
    this.assertStringArray(data.uncertainFields, "uncertainFields", ["storeName", "purchasedAt", "subtotal", "discount", "includedTax", "externalTax", "total"]);
    if (!Array.isArray(data.items)) throw new Error("itemsは配列にしてください。");
    if (data.items.length > 500) throw new Error("商品明細は500件以内にしてください。");
    const itemKeys = ["name", "quantity", "unitPrice", "amount", "category", "uncertainFields"];
    data.items.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`items[${index}]はオブジェクトにしてください。`);
      this.assertAllowedKeys(item, itemKeys, `items[${index}]`);
      ["name", "quantity", "unitPrice", "amount", "category"].forEach((key) => {
        if (!(key in item)) throw new Error(`items[${index}].${key}がありません。不明な場合はnullにしてください。`);
      });
      this.assertNullableString(item.name, `items[${index}].name`, 200);
      if (typeof item.category !== "string" || !this.categoryManager.getAll().some((category) => category.name === item.category)) throw new Error(`items[${index}].categoryは解析指示に記載されたカテゴリ名にしてください。`);
      this.assertNullableNumber(item.quantity, `items[${index}].quantity`, 0.01, 100000);
      this.assertNullableNumber(item.unitPrice, `items[${index}].unitPrice`, 0, 1000000000);
      this.assertNullableNumber(item.amount, `items[${index}].amount`, 0, 1000000000);
      this.assertStringArray(item.uncertainFields, `items[${index}].uncertainFields`, ["name", "quantity", "unitPrice", "amount", "category"]);
    });
  }

  getReconciliationWarnings(receipt) {
    const warnings = [];
    const amounts = receipt.items.map((item) => item.amount);
    const hasAllAmounts = amounts.every((value) => typeof value === "number" && Number.isFinite(value));
    const itemTotal = hasAllAmounts ? amounts.reduce((sum, value) => sum + value, 0) : null;
    const discount = receipt.discount ?? 0;
    const externalTax = receipt.tax ?? 0;
    if (itemTotal !== null && receipt.subtotal !== null && receipt.subtotal !== undefined) {
      const matchesBeforeDiscount = Math.abs(itemTotal - receipt.subtotal) < 1;
      const matchesAfterDiscount = Math.abs(itemTotal - discount - receipt.subtotal) < 1;
      if (!matchesBeforeDiscount && !matchesAfterDiscount) warnings.push(`商品明細(${itemTotal}円)・値引き(${discount}円)と小計(${receipt.subtotal}円)の関係を確認できません`);
    }
    if (receipt.total !== null && receipt.total !== undefined) {
      const candidates = receipt.subtotal === null || receipt.subtotal === undefined
        ? (itemTotal === null ? [] : [itemTotal - discount + externalTax])
        : [receipt.subtotal + externalTax, receipt.subtotal - discount + externalTax];
      if (candidates.length && !candidates.some((value) => Math.abs(value - receipt.total) < 1)) warnings.push(`小計・値引き・外税から支払合計(${receipt.total}円)を確認できません`);
    }
    return warnings;
  }

  resolveCategoryId(name) {
    const categories = this.categoryManager.getAll();
    const normalized = this.normalizeName(name);
    const exact = categories.find((category) => this.normalizeName(category.name) === normalized);
    const unclassified = categories.find((category) => category.name === "未分類");
    return (exact || unclassified || this.categoryManager.getFallback()).id;
  }

  unwrapJsonFence(value) {
    const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return match ? match[1].trim() : value;
  }

  nullableNumber(value, minimum = 0) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= minimum ? number : null;
  }

  assertAllowedKeys(object, allowedKeys, label) {
    const unexpected = Object.keys(object).filter((key) => !allowedKeys.includes(key));
    if (unexpected.length) throw new Error(`${label}に未対応の項目があります: ${unexpected.join("、")}`);
  }

  assertNullableString(value, label, maxLength) {
    if (value === undefined || value === null) return;
    if (typeof value !== "string" || value.length > maxLength) throw new Error(`${label}は${maxLength}文字以内の文字列またはnullにしてください。`);
  }

  assertNullableNumber(value, label, minimum, maximum) {
    if (value === null) return;
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label}は${minimum}以上${maximum}以下の数値またはnullにしてください。`);
  }

  assertStringArray(value, label, allowedValues = null) {
    if (value === undefined) return;
    if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== "string" || item.length > 100 || (allowedValues && !allowedValues.includes(item)))) throw new Error(`${label}はスキーマに記載された項目名の配列にしてください。`);
  }

  createId() {
    return `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  }
};
