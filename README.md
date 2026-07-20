# 背景プロンプト工房

AI画像生成向けの背景を日本語UIで構造的に設計し、自然な英語プロンプトへ変換するWebアプリです。

GitHub Pages: <https://nyuriwossan.github.io/background-prompt-workshop/>

## 主な機能

- 空間背景／シンプル背景の2モード
- Workspace向け短縮版と、背景単体向け詳細版
- 人物と背景の比重を反映した英文生成
- 相性警告と補助候補の提案
- プリセット、端末内保存、JSON入出力、コピー
- スマートフォン対応

旧Background Prompt Builderの単純なタグ連結方式ではなく、IDベースの設計状態から意味順に英文を生成します。ガチャ機能や辞典の検索・比較・お気に入り機能は含みません。

## ローカル実行

Node.js 22以降が必要です。

```bash
npm ci
npm run dev
```

## 検証

```bash
npm test
npm run build
npm run build:pages
```

`npm run build:pages` は、GitHub Pagesへ配置できる静的ファイルを `gh-pages/` に生成します。

## GitHub Pages

`main` ブランチへのpushで、`.github/workflows/deploy-pages.yml` が静的ビルドを作成し、GitHub Pagesへ自動公開します。リポジトリのPages設定は「GitHub Actions」を利用します。
