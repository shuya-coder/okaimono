# Third-party notices

このアプリは、レシート画像を端末内でOCR処理するために以下のオープンソースソフトウェアと学習データを同梱しています。実行時にCDNや外部OCRサービスへ接続しません。

## Tesseract.js 7.0.0

- 配布元: https://github.com/naptha/tesseract.js
- 使用ファイル: `vendor/tesseract/tesseract.min.js`, `vendor/tesseract/worker.min.js`
- ライセンス: Apache License 2.0
- ライセンス本文: `vendor/tesseract/LICENSE.md`

## Tesseract.js Core 7.0.0

- 配布元: https://github.com/naptha/tesseract.js-core
- 使用ファイル: `vendor/tesseract-core/tesseract-core-lstm.wasm.js`, `vendor/tesseract-core/tesseract-core-lstm.wasm`
- ライセンス: Apache License 2.0
- ライセンス本文: `vendor/tesseract-core/LICENSE`

## tessdata_best（日本語・英語）

- 配布元: https://github.com/tesseract-ocr/tessdata_best
- 使用ファイル: `vendor/tessdata/jpn.traineddata.gz`, `vendor/tessdata/eng.traineddata.gz`
- ライセンス: Apache License 2.0
- ライセンス本文: `vendor/tessdata/LICENSE`

学習データは公式リポジトリの `jpn.traineddata` と `eng.traineddata` を取得し、配信容量削減のため内容を変更せずgzip圧縮しています。
