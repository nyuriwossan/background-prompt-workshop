# 背景プロンプト工房

AI画像生成向けの背景を日本語UIで構造的に設計し、生成先に合わせた英語プロンプトへ変換するWebアプリです。

GitHub Pages: <https://nyuriwossan.github.io/background-prompt-workshop/>

## 主な機能

- 空間背景／シンプル背景の2モード
- 4ステップの画面：どんな場所？ → どう見える？ → 細かく仕上げる → 生成先を選んでコピー
- 場所の日本語検索（ひらがな・別名でも探せます）
- **見え方の設計**：どこから見るか・何が見えるか・視線の向き・距離・高度・動き・手前の枠・画角を、場所とは別に指定
  - 成立しない組み合わせは押せなくし、理由を日本語で表示
  - 今の設定で使えなくなった値は、保存したまま出力からだけ外す
- **生成先の切り替え**：汎用（従来どおり）／PIXAI Tsubaki系（自然文）／PIXAIタグ系／NovelAI
  - 短縮版・詳細版と自由に組み合わせ可能
  - ネガティブ・Undesired Contentは、対応する生成先・モードのときだけ作成
  - NovelAIの数値強調は任意（見え方の句だけ）
- **動きのある見え方**：飛行・滑空・急上昇・雲を抜けて降下・急降下・落下・高速で横を通過。移動の向きと遠近の手がかりを先に書き、人物の姿勢と読まれやすい語（falling など）は使いません
- **やり直し**：「選択をクリア」（場所・生成先などは残し、任意の選択をすべて外す）と「初期設定に戻す」（作例の状態に戻す）
- 人物と背景の比重、相性警告と補助提案
- プリセット（空間53件・シンプル15件）、端末内保存、JSON入出力、コピー
- スマートフォン対応（下部にコピー・保存、出力欄へすぐ移動）

## 保存データ

保存形式は v2 です。v1 の下書き・保存一覧・書き出しJSONはそのまま読み込めます（見え方は「標準」、生成先は「汎用」として補われ、従来と同じ英文になります）。初めて v2 で開いたときは、移行前のデータを `background_prompt_workshop_backup_before_v2` に控えとして残します。JSONで保存一覧を読み込むと、今の保存に追加されます（置き換えません）。

## ローカル実行

Node.js 22以降が必要です。

```bash
npm ci
npm run dev
```

## 検証

```bash
npm test             # 生成・移行・矛盾制御の回帰テスト
npm run build
npm run build:pages
```

画面の通しテスト（Python版Playwright）：`gh-pages/` を `/background-prompt-workshop/` で配信してから

```bash
python3 tests/e2e/ui-smoke.py http://localhost:8765/background-prompt-workshop/
```

## GitHub Pages

`main` ブランチへのpushで、`.github/workflows/deploy-pages.yml` が静的ビルドを作成し、GitHub Pagesへ自動公開します。
