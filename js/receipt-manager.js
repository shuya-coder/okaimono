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
    return `添付したレシート写真を読み取り、次のJSONスキーマに厳密に従って出力してください。\n\n${JSON.stringify(schema, null, 2)}\n\nルール:\n- 回答はMarkdownの\`\`\`jsonコードブロック1つだけとし、その中にJSONオブジェクトだけを入れる。説明文は付けない。\n- 写真から確認できない値はnullにし、推測した数値を確定値として書かない。\n- 金額は円単位の数値とし、通貨記号やカンマを含めない。値引額discountは正の数値で記録する。\n- subtotalはレシートに印字された小計または商品合計をそのまま記録し、値引きを独自に足し引きして作らない。\n- includedTaxは小計や商品金額に含まれる内税で、合計計算時に加算しない。\n- externalTaxは別途加算される外税で、合計計算時に一度だけ扱う。\n- 商品ごとのamountはその商品の数量分を含む商品別金額とする。\n- 不確かな項目名をuncertainFieldsへ入れる。\n- カテゴリは次のいずれかを使う: ${categories.join("、")}。判断できない場合は「未分類」にする。\n- 商品ではない小計、値引き、税額、合計、預り金、釣銭をitemsへ入れない。\n- 日時は日本時間のISO 8601形式で記録する。`;
  }

  async importChatGptJson(input) {
    const analysis = await this.analyzeChatGptInput(input);
    if (analysis.candidates.length > 1) throw this.createImportError("AMBIGUOUS_JSON", `${analysis.candidates.length}件の有効なレシートJSONが見つかりました。プレビューで使用する候補を選択してください。`);
    return analysis.candidates[0].receipt;
  }

  async analyzeChatGptInput(input) {
    const source = String(input || "").trim();
    if (!source) throw this.createImportError("JSON_NOT_FOUND", "JSONが見つかりません。ChatGPTの解析結果を貼り付けてください。");
    if (source.length > 500000) throw this.createImportError("NUMBER_OUT_OF_RANGE", "入力が大きすぎます。50万文字以内にしてください。");
    const extraction = this.extractJsonSegments(source);
    if (extraction.segments.length === 0) {
      if (extraction.sawOpeningToken) throw this.createImportError("JSON_SYNTAX", "JSONの開始記号はありますが、閉じ括弧または文字列の引用符が不足しています。");
      throw this.createImportError("JSON_NOT_FOUND", "入力内容からJSONオブジェクトまたは配列を見つけられませんでした。");
    }

    const parsedCandidates = [];
    const syntaxErrors = [];
    extraction.segments.forEach((segment, index) => {
      try {
        parsedCandidates.push({ index, data: JSON.parse(segment.text), rawText: segment.text });
      } catch (error) {
        syntaxErrors.push(this.createImportError("JSON_SYNTAX", `JSON候補${index + 1}の構文が正しくありません。${error.message}`));
      }
    });
    if (parsedCandidates.length === 0) throw syntaxErrors[0] || this.createImportError("JSON_SYNTAX", "JSON構文を解析できませんでした。");

    const validCandidates = [];
    const validationErrors = [];
    for (const candidate of parsedCandidates) {
      try {
        this.validateChatGptReceipt(candidate.data);
        validCandidates.push({
          index: candidate.index,
          data: candidate.data,
          rawText: candidate.rawText,
          receipt: await this.convertChatGptData(candidate.data),
        });
      } catch (error) {
        validationErrors.push({ error, data: candidate.data });
      }
    }
    if (validCandidates.length === 0) {
      const schemaLikeError = validationErrors.find(({ data }) => data && typeof data === "object" && !Array.isArray(data) && ("schemaVersion" in data || "items" in data));
      throw schemaLikeError?.error || validationErrors[0]?.error || syntaxErrors[0] || this.createImportError("SCHEMA_MISMATCH", "既存スキーマに適合するJSONがありませんでした。");
    }
    return { candidates: validCandidates, ignoredCandidateCount: parsedCandidates.length - validCandidates.length + syntaxErrors.length };
  }

  async convertChatGptData(data) {
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
    if (!data || typeof data !== "object" || Array.isArray(data)) throw this.createImportError("TYPE_MISMATCH", "JSONの最上位はオブジェクトにしてください。");
    const topKeys = ["schemaVersion", "storeName", "purchasedAt", "items", "subtotal", "discount", "includedTax", "externalTax", "total", "uncertainFields", "notes"];
    this.assertAllowedKeys(data, topKeys, "最上位");
    if (!("schemaVersion" in data)) throw this.createImportError("REQUIRED_FIELD_MISSING", "必須項目schemaVersionがありません。");
    if (data.schemaVersion !== "okaimono-receipt-v1") throw this.createImportError("SCHEMA_MISMATCH", "スキーマがokaimono-receipt-v1と一致しません。解析指示をコピーし直してください。");
    ["storeName", "purchasedAt", "subtotal", "discount", "includedTax", "externalTax", "total"].forEach((key) => {
      if (!(key in data)) throw this.createImportError("REQUIRED_FIELD_MISSING", `必須項目${key}がありません。不明な場合はnullにしてください。`);
    });
    this.assertNullableString(data.storeName, "storeName", 200);
    this.assertNullableString(data.notes, "notes", 5000);
    if (data.purchasedAt !== null && (typeof data.purchasedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(data.purchasedAt) || Number.isNaN(Date.parse(data.purchasedAt)))) {
      throw this.createImportError("TYPE_MISMATCH", "purchasedAtはタイムゾーン付きISO 8601形式またはnullにしてください。");
    }
    ["subtotal", "discount", "includedTax", "externalTax", "total"].forEach((key) => this.assertNullableNumber(data[key], key, 0, 1000000000));
    this.assertStringArray(data.uncertainFields, "uncertainFields", ["storeName", "purchasedAt", "subtotal", "discount", "includedTax", "externalTax", "total"]);
    if (!("items" in data)) throw this.createImportError("REQUIRED_FIELD_MISSING", "必須項目itemsがありません。");
    if (!Array.isArray(data.items)) throw this.createImportError("TYPE_MISMATCH", "itemsは配列にしてください。");
    if (data.items.length > 500) throw this.createImportError("NUMBER_OUT_OF_RANGE", "商品明細は500件以内にしてください。");
    const itemKeys = ["name", "quantity", "unitPrice", "amount", "category", "uncertainFields"];
    data.items.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw this.createImportError("TYPE_MISMATCH", `items[${index}]はオブジェクトにしてください。`);
      this.assertAllowedKeys(item, itemKeys, `items[${index}]`);
      ["name", "quantity", "unitPrice", "amount", "category"].forEach((key) => {
        if (!(key in item)) throw this.createImportError("REQUIRED_FIELD_MISSING", `必須項目items[${index}].${key}がありません。不明な場合はnullにしてください。`);
      });
      this.assertNullableString(item.name, `items[${index}].name`, 200);
      if (typeof item.category !== "string" || !this.categoryManager.getAll().some((category) => category.name === item.category)) throw this.createImportError("INVALID_CATEGORY", `items[${index}].category「${String(item.category)}」は利用できません。解析指示に記載されたカテゴリ名を使用してください。`);
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
      if (!matchesBeforeDiscount && !matchesAfterDiscount) {
        const differences = [receipt.subtotal - itemTotal, receipt.subtotal - (itemTotal - discount)];
        const closestDifference = differences.reduce((closest, value) => Math.abs(value) < Math.abs(closest) ? value : closest);
        warnings.push(`商品明細・値引きと小計の差額は${closestDifference}円です`);
      }
    }
    if (receipt.total !== null && receipt.total !== undefined) {
      const candidates = receipt.subtotal === null || receipt.subtotal === undefined
        ? (itemTotal === null ? [] : [itemTotal - discount + externalTax])
        : [receipt.subtotal + externalTax, receipt.subtotal - discount + externalTax];
      if (candidates.length && !candidates.some((value) => Math.abs(value - receipt.total) < 1)) {
        const closest = candidates.reduce((current, value) => Math.abs(receipt.total - value) < Math.abs(receipt.total - current) ? value : current);
        warnings.push(`計算額(${closest}円)とレシート記載の支払合計(${receipt.total}円)の差額は${receipt.total - closest}円です`);
      }
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

  extractJsonSegments(source) {
    const segments = [];
    let sawOpeningToken = false;
    for (let index = 0; index < source.length; index += 1) {
      if (source[index] !== "{" && source[index] !== "[") continue;
      sawOpeningToken = true;
      const segment = this.readBalancedJson(source, index);
      if (!segment.complete) continue;
      segments.push({ text: source.slice(index, segment.end + 1), start: index, end: segment.end });
      index = segment.end;
    }
    return { segments, sawOpeningToken };
  }

  readBalancedJson(source, start) {
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === "{" || character === "[") {
        stack.push(character === "{" ? "}" : "]");
        continue;
      }
      if (character === "}" || character === "]") {
        if (stack.pop() !== character) return { complete: false, end: index };
        if (stack.length === 0) return { complete: true, end: index };
      }
    }
    return { complete: false, end: source.length - 1 };
  }

  nullableNumber(value, minimum = 0) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= minimum ? number : null;
  }

  assertAllowedKeys(object, allowedKeys, label) {
    const unexpected = Object.keys(object).filter((key) => !allowedKeys.includes(key));
    if (unexpected.length) throw this.createImportError("SCHEMA_MISMATCH", `${label}にスキーマ外の項目があります: ${unexpected.join("、")}`);
  }

  assertNullableString(value, label, maxLength) {
    if (value === undefined || value === null) return;
    if (typeof value !== "string") throw this.createImportError("TYPE_MISMATCH", `${label}は文字列またはnullにしてください。`);
    if (value.length > maxLength) throw this.createImportError("NUMBER_OUT_OF_RANGE", `${label}は${maxLength}文字以内にしてください。`);
  }

  assertNullableNumber(value, label, minimum, maximum) {
    if (value === null) return;
    if (typeof value !== "number" || !Number.isFinite(value)) throw this.createImportError("TYPE_MISMATCH", `${label}は数値またはnullにしてください。`);
    if (value < minimum || value > maximum) throw this.createImportError("NUMBER_OUT_OF_RANGE", `${label}は${minimum}以上${maximum}以下にしてください。`);
  }

  assertStringArray(value, label, allowedValues = null) {
    if (value === undefined) return;
    if (!Array.isArray(value)) throw this.createImportError("TYPE_MISMATCH", `${label}は文字列配列にしてください。`);
    if (value.length > 100 || value.some((item) => typeof item === "string" && item.length > 100)) throw this.createImportError("NUMBER_OUT_OF_RANGE", `${label}は100件以内・各100文字以内にしてください。`);
    if (value.some((item) => typeof item !== "string")) throw this.createImportError("TYPE_MISMATCH", `${label}の各値は文字列にしてください。`);
    if (allowedValues && value.some((item) => !allowedValues.includes(item))) throw this.createImportError("SCHEMA_MISMATCH", `${label}にはスキーマに記載された項目名だけを指定してください。`);
  }

  createImportError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  createId() {
    return `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  }
};
