# 買い物リストWebアプリ

HTML、CSS、Vanilla JavaScriptだけで動く、スマホ向けの買い物リストWebアプリです。
サーバー、データベース、npm、Node.js、ビルド作業は不要です。

データはブラウザのLocalStorageに保存されます。アプリ本体はフォルダをコピーするだけで別PCへ移せますが、買い物データはCSVでバックアップして移行します。


## すぐ使うURL

アプリをブラウザで直接開くURL:

https://shuya-coder.github.io/okaimono/

GitHubリポジトリURL:

https://github.com/shuya-coder/okaimono

上のアプリURLが404になる場合は、GitHub Pagesがまだ有効になっていません。GitHubのリポジトリ画面で `Settings` → `Pages` を開き、`Branch` を `main`、フォルダを `/root` にして保存してください。数分後に上のURLで開けるようになります。

## まず読むところ

別のパソコンですぐ使いたい場合は、次の順番で進めてください。

1. `shopping-app` フォルダを新しいPCへコピーする
2. 新しいPCで `shopping-app/index.html` を開く
3. 元PCのデータも使う場合は、元PCでCSV保存して新PCでCSV読込する
4. PWAやオフライン利用を使う場合は、VSCodeのLive Serverで起動する

## アプリの場所

現在の想定フォルダは以下です。

```text
C:\Users\shuma\OneDrive\お買い物アプリ\shopping-app
```

この中の `index.html` がアプリ本体です。

```text
C:\Users\shuma\OneDrive\お買い物アプリ\shopping-app\index.html
```

## できること

- 商品を買い物リストへ追加
- 同じ商品を追加したときは個数を加算
- 商品をリストからカートへ移動
- カートの商品をリストへ戻す
- カートの商品数を増減
- カートの商品を削除
- カート内の商品を会計済みにして履歴へ保存
- 履歴を日付ごとに確認
- 履歴を商品名、日付、カテゴリーで絞り込み
- カテゴリー名と色を編集
- CSVでデータをバックアップ、復元
- ダークモード切替
- LocalStorage初期化
- PWAとしてホーム画面へ追加
- オフライン利用

## 画面構成

- 📝 リスト
- 🛒 カート
- 📜 履歴
- ⚙ 設定

## 動作環境

PC:

- Google Chrome
- Microsoft Edge
- Firefox
- Safari

スマートフォン:

- Android Chrome
- Android Edge
- iPhone Safari

推奨はChromeまたはEdgeです。

## 必要なもの

使うだけなら以下だけで動きます。

- ブラウザ
- `shopping-app` フォルダ一式

開発やPWA確認まで行う場合は以下も使います。

- VSCode
- VSCode拡張機能 `Live Server`

不要なもの:

- Node.js
- npm
- yarn
- Vite
- React
- Vue
- サーバー
- データベース

## すぐに起動する方法

一番簡単な確認方法です。

1. `shopping-app` フォルダを開きます。
2. `index.html` をダブルクリックします。
3. ブラウザでアプリが開きます。

この方法でも基本機能は使えます。
ただし、PWA、ホーム画面追加、Service Worker、オフラインキャッシュの確認にはLive ServerなどのHTTP環境が必要です。

## VSCodeで開く方法

1. VSCodeを起動します。
2. `ファイル` をクリックします。
3. `フォルダーを開く` をクリックします。
4. 以下のフォルダを選択します。

```text
C:\Users\shuma\OneDrive\お買い物アプリ\shopping-app
```

5. 左側のファイル一覧から `index.html` を開きます。

## Live Serverで起動する方法

PWAやオフライン利用を確認する場合は、この方法を使ってください。

1. VSCodeで `shopping-app` フォルダを開きます。
2. 左側の拡張機能アイコンを開きます。
3. `Live Server` を検索します。
4. `Live Server` をインストールします。
5. `index.html` を右クリックします。
6. `Open with Live Server` をクリックします。
7. ブラウザでアプリが開きます。

URL例:

```text
http://127.0.0.1:5500/index.html
```

または以下のようなURLになります。

```text
http://localhost:5500/index.html
```

## 別のパソコンへアプリを移す方法

アプリ本体だけを移す場合の手順です。

1. 元PCで以下のフォルダを探します。

```text
C:\Users\shuma\OneDrive\お買い物アプリ\shopping-app
```

2. `shopping-app` フォルダを丸ごとコピーします。
3. USBメモリ、OneDrive、Google Drive、Dropbox、ZIPファイルなどで新しいPCへ移します。
4. 新しいPCで `shopping-app` フォルダを開きます。
5. `index.html` をブラウザで開きます。

重要: `index.html` だけをコピーしないでください。`css`、`js`、`assets` も必要です。必ず `shopping-app` フォルダごとコピーしてください。

## 別のパソコンへデータも移す方法

買い物リスト、カート、履歴、カテゴリーを移す場合はCSVを使います。

元PCで行うこと:

1. アプリを開きます。
2. `⚙ 設定` タブを開きます。
3. `CSV保存` を押します。
4. CSVファイルがダウンロードされます。
5. CSVファイルを新しいPCへ移します。

新PCで行うこと:

1. `shopping-app` フォルダを新PCへコピーします。
2. 新PCで `index.html` を開きます。
3. `⚙ 設定` タブを開きます。
4. `CSV読込` を押します。
5. 元PCで保存したCSVファイルを選びます。
6. リスト、カート、履歴、カテゴリーが復元されます。

LocalStorageはブラウザごと、PCごとに別管理です。
そのため、アプリ本体をコピーしただけでは買い物データは移りません。
データ移行には必ずCSV保存とCSV読込を使ってください。

## OneDriveで同期して使う場合の注意

`shopping-app` フォルダをOneDriveに置くと、アプリ本体のHTML、CSS、JavaScriptは同期できます。

ただし、LocalStorageの中身はOneDriveでは同期されません。
買い物データを別PCへ移す場合は、OneDriveを使っている場合でもCSV保存とCSV読込が必要です。

## スマートフォンで使う方法

スマートフォンで使う方法は主に2つあります。

### 方法1: PCのLive Serverへスマホからアクセスする

1. PCとスマートフォンを同じWi-Fiに接続します。
2. PCでVSCodeを開きます。
3. Live Serverで `index.html` を起動します。
4. PCのローカルIPアドレスを確認します。
5. スマートフォンのブラウザで以下のようなURLを開きます。

```text
http://PCのIPアドレス:5500/index.html
```

例:

```text
http://192.168.1.10:5500/index.html
```

### 方法2: スマホで直接HTMLを開く

スマートフォン内に `shopping-app` フォルダを置き、`index.html` を開きます。
ただし、この方法ではPWAやService Workerが正しく動かない場合があります。

## ホーム画面に追加する方法

PWAとして使う場合の手順です。

1. Live ServerなどでHTTP経由でアプリを開きます。
2. ブラウザのメニューを開きます。
3. `ホーム画面に追加` を選びます。
4. ホーム画面に追加されたアイコンから起動します。

注意:

- `file://` で開いた場合、Service Workerは動きません。
- PWA確認には `http://localhost`、ローカルIP、またはHTTPS環境が必要です。
- 初回はオンラインで開き、Service Workerを登録してください。

## 基本的な使い方

### 商品を追加する

1. `📝 リスト` タブを開きます。
2. `＋ 商品を追加` を押します。
3. 商品名を入力します。
4. 個数を選びます。
5. カテゴリーを選びます。
6. `リストに追加` を押します。

商品追加後の動作:

- 商品名だけ空になります。
- 個数は `1` に戻ります。
- カテゴリーは前回選択したものが維持されます。
- 商品名入力欄にフォーカスが戻ります。
- 続けて次の商品を入力できます。

### リストの商品を操作する

商品カードには以下のボタンがあります。

```text
[カート] [＋] [－] [削除]
```

- `カート`: 商品をカートへ移動します
- `＋`: 個数を1つ増やします
- `－`: 個数を1つ減らします
- `削除`: 商品を削除します

削除時は確認ダイアログが表示されます。

### カートの商品を操作する

カートの商品カードには以下のボタンがあります。

```text
[戻す] [＋] [－] [削除]
```

- `戻す`: 商品をリストへ戻します
- `＋`: 個数を1つ増やします
- `－`: 個数を1つ減らします
- `削除`: カートから削除します

### 会計済みにする

1. `🛒 カート` タブを開きます。
2. 商品を確認します。
3. `会計済み` を押します。
4. 確認ダイアログでOKを押します。

会計済みにした商品はカートから消え、履歴へ保存されます。

### 履歴を見る

`📜 履歴` タブでは、会計済みにした商品を日付ごとに確認できます。

検索できる条件:

- 商品名
- カテゴリー
- 開始日
- 終了日

### カテゴリーを編集する

`⚙ 設定` タブでカテゴリーを管理できます。

できること:

- カテゴリー追加
- カテゴリー名変更
- カテゴリー色変更
- カテゴリー削除

初期カテゴリー:

- 食料品 `#4CAF50`
- 日用品 `#2196F3`

## CSVバックアップ

データを残したい場合は、定期的にCSV保存してください。

CSVに含まれるデータ:

- 買い物リストの商品
- カートの商品
- カテゴリー
- 買い物履歴

バックアップ手順:

1. `⚙ 設定` タブを開きます。
2. `CSV保存` を押します。
3. ダウンロードされたCSVファイルを保管します。

復元手順:

1. `⚙ 設定` タブを開きます。
2. `CSV読込` を押します。
3. 保存しておいたCSVファイルを選択します。

注意:

- CSV読込を行うと、現在のLocalStorageデータはCSVの内容で置き換わります。
- 必要なデータが残っている場合は、先にCSV保存してください。
- 表計算ソフトでCSVの列名や列数を変更すると、正しく読み込めない場合があります。

## データ保存について

データはLocalStorageに保存されます。
保存キーは以下です。

- `shoppingApp:shoppingItems`
- `shoppingApp:categories`
- `shoppingApp:shoppingHistory`
- `shoppingApp:darkMode`

商品データは内部的に `status` でリストとカートを区別します。

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

内部データでは `cart` という英語の値を使いますが、画面表示では「カート」に統一しています。

## PWA対応

このアプリには以下が含まれています。

- `manifest.webmanifest`
- `sw.js`
- アプリアイコン
- オフラインキャッシュ
- ホーム画面追加時のスタンドアロン起動

PWAとして正しく確認するには、Live ServerなどでHTTP経由で起動してください。

## フォルダ構成

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

## ファイルの役割

- `index.html`: 画面構造
- `css/style.css`: デザイン、スマホ対応、ダークモード
- `js/app.js`: アプリ起動処理
- `js/storage.js`: LocalStorage操作
- `js/shopping.js`: リストとカートの商品管理
- `js/history.js`: 履歴管理
- `js/category.js`: カテゴリー管理
- `js/ui.js`: 画面描画とイベント処理
- `manifest.webmanifest`: PWA設定
- `sw.js`: オフラインキャッシュ
- `assets/`: アイコン画像

## 新しいPCでの導入チェックリスト

新しいPCで使う前に、以下を確認してください。

- `shopping-app` フォルダを丸ごとコピーした
- `index.html` が存在する
- `css/style.css` が存在する
- `js/ui.js` が存在する
- `js/shopping.js` が存在する
- `assets/icon-192.png` が存在する
- ブラウザで `index.html` を開ける
- 元PCのデータが必要な場合はCSV保存した
- 新PCでCSV読込した
- PWA確認が必要な場合はLive Serverで開いた

## よくあるトラブル

### index.htmlだけコピーしたらデザインが崩れる

`css`、`js`、`assets` が足りません。
`shopping-app` フォルダごとコピーしてください。

### データが別PCで表示されない

LocalStorageはPCやブラウザごとに別です。
元PCでCSV保存し、新PCでCSV読込してください。

### Chromeでは見えるがEdgeではデータがない

LocalStorageはブラウザごとに別です。
同じPCでもChromeとEdgeではデータが共有されません。
CSV保存とCSV読込で移してください。

### ホーム画面追加できない

`file://` で開いている場合、PWA機能は有効になりません。
Live Serverなどで `http://localhost` から開いてください。

### オフラインで使えない

一度HTTP環境で開き、Service Workerが登録される必要があります。
初回表示後にブラウザを再読み込みしてから確認してください。

### 画面が古いまま変わらない

ブラウザのキャッシュが残っている可能性があります。
再読み込み、またはブラウザのキャッシュ削除を試してください。

### CSV読込に失敗する

このアプリからCSV保存したファイルを使ってください。
表計算ソフトで列名や列数を変更すると、正しく読み込めない場合があります。

### 文字化けする

ファイルはUTF-8で保存してください。
VSCodeで開く場合は、右下の文字コードが `UTF-8` になっていることを確認してください。

## 開発メモ

- フレームワークは使用していません。
- JavaScriptは機能ごとにファイル分割しています。
- グローバル変数は `window.ShoppingApp` 名前空間にまとめています。
- 外部APIやクラウド同期は使用していません。
- 今後、ログイン、共有、クラウド同期、通知、店舗別リストなどを追加しやすいよう、管理クラスを分けています。

