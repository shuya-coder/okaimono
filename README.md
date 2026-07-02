# 買い物リストWebアプリ

HTML・CSS・Vanilla JavaScript のみで動作する LocalStorage 保存型の買い物リストです。

## セットアップ

1. VSCode で `shopping-app` フォルダを開きます。
2. `index.html` をブラウザで開きます。
3. Live Server 拡張機能を使う場合は、`index.html` を右クリックして `Open with Live Server` を選びます。

ビルド、npm、外部ライブラリは不要です。

## UI/UX

- スマートフォン優先のモバイルファースト設計
- 下部固定ナビゲーションで片手操作しやすい配置
- 買い物リスト画面からすぐ商品追加へ進める固定追加ボタン
- 44px以上のタップ領域
- 商品名・個数・カテゴリーを大きく読みやすく表示
- カテゴリー色の左バーと色ドットで視認性を向上
- 保存・削除などの操作後に短い通知を表示
- キーボード操作とスクリーンリーダー向けのラベルを設定

## PWA

以下を実装済みです。

- `manifest.webmanifest`
- `sw.js`
- SVGアプリアイコン
- オフラインキャッシュ
- ホーム画面追加時のスタンドアロン起動

Service Worker は `file://` では有効にならないため、PWA とオフライン動作の確認は Live Server などの `http://localhost` 環境で行ってください。

## タブ構成

- 🛒 買い物リスト
- ➕ 商品追加
- 📜 買い物履歴
- ⚙ 設定

## 主な機能

- 商品名、個数、カテゴリーを指定した買い物リスト登録
- 同名商品を追加した場合の個数加算
- 商品名検索とカテゴリー絞り込み
- 購入済みチェック、購入済み一括削除
- 過去の商品検索からの商品名・カテゴリー自動入力
- 過去3か月の買い物履歴表示
- 履歴の商品名検索、カテゴリー絞り込み
- カテゴリー名と色の追加・編集・削除
- カテゴリー色による買い物リストの視認性向上
- CSVエクスポート、CSVインポート
- ダークモード切替
- LocalStorage初期化

## 初期カテゴリー

- 食料品 `#4CAF50`
- 日用品 `#2196F3`

## 保存データ

LocalStorage には以下のキーで保存します。

- `shoppingApp:shoppingItems`
- `shoppingApp:categories`
- `shoppingApp:shoppingHistory`

ダークモード設定は `shoppingApp:darkMode` に保存します。

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

- `Storage` が LocalStorage の読み書きを担当します。
- `ShoppingManager` が現在の買い物リストを管理します。
- `HistoryManager` が追加・購入履歴を管理します。
- `CategoryManager` がカテゴリー名と色を管理します。
- `UI` が描画とイベントを担当します。
- 複数JSファイルを直接ブラウザで読み込めるよう、グローバルは `window.ShoppingApp` 名前空間にまとめています。

履歴管理と買い物リスト管理を分離しているため、今後の購入履歴分析、店舗別リスト、通知、共有、クラウド同期などを追加しやすい構成です。
