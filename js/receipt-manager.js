window.ShoppingApp = window.ShoppingApp || {};

window.ShoppingApp.ReceiptManager = class ReceiptManager {
  constructor(db, categoryManager) {
    this.db = db;
    this.categoryManager = categoryManager;
    this.worker = null;
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
      quantity: Math.max(0.01, Number(item.quantity) || 1),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      amount: Math.max(0, Number(item.amount) || 0),
      categoryId: Number(item.categoryId) || this.categoryManager.getFallback().id,
      uncertain: Boolean(item.uncertain),
    }));
    const normalized = {
      id: receipt.id || this.createId(),
      storeName: String(receipt.storeName || "店舗不明").trim(),
      purchasedAt: receipt.purchasedAt || new Date().toISOString(),
      items,
      discount: Math.max(0, Number(receipt.discount) || 0),
      tax: Math.max(0, Number(receipt.tax) || 0),
      total: Math.max(0, Number(receipt.total) || 0),
      notes: String(receipt.notes || ""),
      rawText: String(receipt.rawText || ""),
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
    const existing = await this.db.getAllMappings();
    const map = new Map(existing.map((item) => [item.alias, item]));
    for (const item of items) {
      const alias = this.normalizeName(item.rawName);
      const canonical = this.normalizeName(item.name);
      if (!alias || !canonical) continue;
      const mapping = { alias, canonicalName: item.name, categoryId: item.categoryId, updatedAt: new Date().toISOString() };
      map.set(alias, mapping);
      await this.db.saveMapping(mapping);
    }
  }

  async applyLearnedMapping(rawName) {
    const alias = this.normalizeName(rawName);
    const mappings = await this.db.getAllMappings();
    const exact = mappings.find((mapping) => mapping.alias === alias);
    if (exact) return exact;
    return { canonicalName: rawName.trim(), categoryId: this.guessCategory(rawName) };
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

  async recognize(file, onProgress = () => {}) {
    const image = await this.preprocessImage(file);
    if (!window.Tesseract) throw new Error("OCRライブラリを読み込めませんでした");
    if (!this.worker) {
      this.worker = await window.Tesseract.createWorker("jpn+eng", 1, {
        workerPath: new URL("vendor/tesseract/worker.min.js", window.location.href).href,
        corePath: new URL("vendor/tesseract-core/tesseract-core-lstm.wasm.js", window.location.href).href,
        langPath: new URL("vendor/tessdata", window.location.href).href,
        gzip: true,
        logger: onProgress,
      });
      await this.worker.setParameters({ preserve_interword_spaces: "1" });
    }
    const result = await this.worker.recognize(image);
    return this.parseOcr(result.data.text, result.data.confidence);
  }

  async preprocessImage(file) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    await image.decode();
    const maxWidth = 2200;
    const scale = Math.min(2, maxWidth / image.width);
    let canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    let context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const skew = this.estimateSkew(context, canvas.width, canvas.height);
    if (Math.abs(skew) >= 0.6) {
      const rotated = document.createElement("canvas");
      rotated.width = canvas.width;
      rotated.height = canvas.height;
      const rotatedContext = rotated.getContext("2d", { willReadFrequently: true });
      rotatedContext.fillStyle = "#fff";
      rotatedContext.fillRect(0, 0, rotated.width, rotated.height);
      rotatedContext.translate(rotated.width / 2, rotated.height / 2);
      rotatedContext.rotate((-skew * Math.PI) / 180);
      rotatedContext.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      canvas = rotated;
      context = rotatedContext;
      context.setTransform(1, 0, 0, 1, 0, 0);
    }
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < data.data.length; index += 4) {
      const gray = data.data[index] * 0.299 + data.data[index + 1] * 0.587 + data.data[index + 2] * 0.114;
      const enhanced = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 145));
      data.data[index] = enhanced;
      data.data[index + 1] = enhanced;
      data.data[index + 2] = enhanced;
    }
    context.putImageData(data, 0, 0);
    URL.revokeObjectURL(url);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("画像を変換できませんでした")), "image/jpeg", 0.92));
  }

  estimateSkew(context, width, height) {
    const maxSampleWidth = 700;
    const step = Math.max(2, Math.ceil(width / maxSampleWidth));
    const image = context.getImageData(0, 0, width, height).data;
    const darkPoints = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const offset = (y * width + x) * 4;
        const gray = image[offset] * 0.299 + image[offset + 1] * 0.587 + image[offset + 2] * 0.114;
        if (gray < 120) darkPoints.push([x / step, y / step]);
      }
    }
    if (darkPoints.length < 100 || darkPoints.length > 120000) return 0;
    let bestAngle = 0;
    let bestScore = -Infinity;
    for (let angle = -5; angle <= 5; angle += 0.5) {
      const slope = Math.tan((angle * Math.PI) / 180);
      const rows = new Map();
      darkPoints.forEach(([x, y]) => {
        const row = Math.round(y + slope * x);
        rows.set(row, (rows.get(row) || 0) + 1);
      });
      let score = 0;
      rows.forEach((count) => { score += count * count; });
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }
    return bestAngle;
  }

  async parseOcr(text, confidence = 0) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const amountPattern = /(?:¥|￥)?\s*([\d,]+)\s*円?$/;
    const datePattern = /(20\d{2})[\/年.-](\d{1,2})[\/月.-](\d{1,2})/;
    const timePattern = /(\d{1,2}):(\d{2})/;
    const totalLine = [...lines].reverse().find((line) => /合計|総額|お買上/.test(line) && amountPattern.test(line));
    const taxLine = [...lines].reverse().find((line) => /税/.test(line) && amountPattern.test(line));
    const discountLines = lines.filter((line) => /値引|割引|クーポン/.test(line) && amountPattern.test(line));
    const dateLine = lines.find((line) => datePattern.test(line));
    let purchasedAt = new Date();
    if (dateLine) {
      const dateMatch = dateLine.match(datePattern);
      const timeMatch = dateLine.match(timePattern);
      purchasedAt = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), Number(timeMatch?.[1] || 12), Number(timeMatch?.[2] || 0));
    }
    const skipWords = /合計|小計|税|お預|お釣|現金|カード|電話|TEL|領収|レシート|値引|割引/;
    const itemLines = lines.filter((line) => amountPattern.test(line) && !datePattern.test(line) && !skipWords.test(line) && line.replace(amountPattern, "").trim());
    const items = [];
    for (const line of itemLines) {
      const amount = Number(line.match(amountPattern)?.[1].replaceAll(",", "") || 0);
      const rawName = line.replace(amountPattern, "").replace(/^[*※・\-]+/, "").trim();
      const quantityMatch = rawName.match(/(?:x|×)\s*(\d+(?:\.\d+)?)/i);
      const quantity = Number(quantityMatch?.[1] || 1);
      const cleanName = rawName.replace(/(?:x|×)\s*\d+(?:\.\d+)?/i, "").trim();
      const mapping = await this.applyLearnedMapping(cleanName);
      items.push({ id: this.createId(), rawName: cleanName, name: mapping.canonicalName, quantity, unitPrice: quantity ? Math.round(amount / quantity) : amount, amount, categoryId: mapping.categoryId, uncertain: confidence < 75 });
    }
    const amountOf = (line) => Number(line?.match(amountPattern)?.[1].replaceAll(",", "") || 0);
    const total = amountOf(totalLine) || items.reduce((sum, item) => sum + item.amount, 0);
    const discount = discountLines.reduce((sum, line) => sum + amountOf(line), 0);
    const storeName = lines.find((line) => !amountPattern.test(line) && !datePattern.test(line) && line.length >= 2 && line.length <= 40) || "店舗不明";
    return { storeName, purchasedAt: purchasedAt.toISOString(), items, discount, tax: amountOf(taxLine), total, notes: "", rawText: text, needsReview: confidence < 75 || !totalLine || items.length === 0 };
  }

  createId() {
    return `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  }
};
