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
本ミドルウェアはエッジ環境での「高速なステートレス」を基本としていますが、Core層には一回性チェックを行うための ReceiptStore インターフェースが実装済みです。本番環境で厳密なリプレイ耐性を担保する場合は、初期化時に new Payment402(verifiers, { receiptStore: new MyCloudflareKVStore() }) のようにストアを注入（DI）することで、コードを汚さずに堅牢な状態管理を追加できます。
---
