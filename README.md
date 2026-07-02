# 買い物リストWebアプリ

HTML・CSS・Vanilla JavaScript のみで動作する、LocalStorage保存型の買い物アプリです。
スマートフォンで買い物中に片手操作しやすいよう、商品追加、リスト確認、カゴ移動、会計済み処理をシンプルにまとめています。

## セットアップ

1. VSCodeで `shopping-app` フォルダを開きます。
2. `index.html` をブラウザで開きます。
3. PWAやオフライン動作を確認する場合は、VSCodeのLive Serverなどで `http://localhost` から開いてください。

ビルド、npm、外部ライブラリは不要です。

## タブ構成

- 🛒 リスト
- 🧺 カゴ
- 📜 履歴
- ⚙ 設定

## 主な機能

- リスト画面の「＋ 商品を追加」を開き、商品名、個数、カテゴリーを入力して追加
- 同名商品を追加した場合は個数を加算し、最近更新した商品として上部へ表示
- リストの商品カードから「🧺」「＋」「－」「🗑」を一列で操作
- カゴの商品カードから「戻す」「＋」「－」「🗑」を一列で操作
- カゴの商品を「リストに戻す」でリストへ戻す
- カゴの「会計済み」でカゴ内商品を一括削除し、履歴へ保存
- 履歴を日付ごとにグループ表示
- 履歴の商品名検索、日付範囲検索、カテゴリー絞り込み
- 履歴の個別削除、日付ごとの一括削除
- カテゴリー名と色の追加、編集、削除
- CSVエクスポート、CSVインポート
- ダークモード切替
- LocalStorage初期化
- PWA対応とオフラインキャッシュ

## 初期カテゴリー

- 食料品 `#4CAF50`
- 日用品 `#2196F3`

## 保存データ

LocalStorageには以下のキーで保存します。

- `shoppingApp:shoppingItems`
- `shoppingApp:categories`
- `shoppingApp:shoppingHistory`
- `shoppingApp:darkMode`

商品データは `status` でリストとカゴを区別します。

```javascript
{
  id: 1,
  name: "牛乳",
  count: 2,
  categoryId: 1,
  status: "list", // "list" または "cart"
  checked: false,
  createdAt: "2026-07-02T10:00:00.000Z"
}
```

## PWA

以下を実装しています。

- `manifest.webmanifest`
- `sw.js`
- アプリアイコン
- オフラインキャッシュ
- ホーム画面追加時のスタンドアロン起動

Service Workerは `file://` では有効になりません。PWAとオフライン動作の確認はLive Serverなどの `http://localhost` 環境で行ってください。

## ファイル構成

```text
shopping-app/
├── index.html
├── manifest.webmanifest
├── sw.js
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── storage.js
│   ├── shopping.js
│   ├── history.js
│   ├── category.js
│   └── ui.js
└── assets/
    ├── icon-192.png
    ├── icon-512.png
    ├── icon.svg
    └── icon-maskable.svg
```

## 設計メモ

- `Storage` がLocalStorageの読み書きを担当します。
- `ShoppingManager` がリストとカゴの商品状態を管理します。
- `HistoryManager` が会計済みにした商品の履歴を管理します。
- `CategoryManager` がカテゴリー名と色を管理します。
- `UI` が描画とイベントを担当します。
- グローバル変数は `window.ShoppingApp` 名前空間にまとめています。

買い物リスト管理、履歴管理、カテゴリー管理を分離しているため、今後の購入履歴分析、店舗別リスト、通知、共有、クラウド同期、ログイン機能などを追加しやすい構成です。
