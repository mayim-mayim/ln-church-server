# ⛩️ Monzenmachi Hono Starter Kit

> AIエージェントのための「門前町（自律決済ゲートウェイ）」を、Cloudflare Workers 上に5分で構築するための最強のスターターキットです。

このプロジェクトは、AIエージェント向けの決済ミドルウェア [`@ln-church/server`](https://github.com/mayim-mayim/ln-church-server) を使用し、Hono フレームワーク上で動作します。L402 (Lightning Network) と Faucet (テスト用蛇口) の両方に対応した「おみくじAPI」が最初から組み込まれています。

## 🚀 5分でできるクイックスタート

### 1. インストール
リポジトリをクローン（またはこのフォルダをコピー）し、依存関係をインストールします。

```bash
cd examples/hono-app
npm install
```

### 2. 環境変数（シークレット）の設定
ローカル開発用に、秘密鍵を設定します。
プロジェクトのルート（`examples/hono-app/` 直下）に **`.dev.vars`** というファイルを作成し、以下の内容を記述してください。

```text
# .dev.vars
FAUCET_SECRET="your-local-test-faucet-secret"
MACAROON_SECRET="your-local-test-macaroon-secret"
```
> **🚨 警告:** `.dev.vars` は絶対に Git にコミットしないでください！

### 3. ローカルサーバーの起動
Wrangler (CloudflareのCLIツール) を使って、ローカル環境でエッジサーバーを立ち上げます。

```bash
npm run dev
```
`Ready on http://127.0.0.1:8787` と表示されれば準備完了です！

### 4. エージェントの気分でテスト（祈祷）
別のターミナルを開き、AIエージェントの代わりにおみくじAPIを叩いてみましょう。

```bash
# 罰当たり（支払いなし）でアクセスしてみる
curl -X POST http://localhost:8787/api/agent/omikuji
```

サーバーは賢く `402 Payment Required` を返し、**「Faucetでテストトークンをもらうか、L402で 10 SATS 払いなさい」** という機械読解可能な指示（HATEOAS）を出力するはずです。


### セキュリティモデルに関する注記（リプレイ耐性について）
本ミドルウェアは、エッジ環境での「完全ステートレス」を優先しているため、検証機単体ではリプレイ攻撃（同じマカロンの再送信）を防ぎません。本番環境で厳密な一回性を保証する場合は、Cloudflare KV 等を利用して receiptId (payment_hash) の使用済みチェックをアプリケーション層で行うか、上流の LND ノードでインボイスのステータスを確認するアーキテクチャを併用してください。
---
