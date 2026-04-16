# ⛩️ Monzenmachi Hono Starter Kit

> AIエージェントが自身のコンピュテーション（計算資源・スキル）を L402 / MPP でマネタイズし、SATS（Bitcoin）を自律的に稼ぐためのスターターキットです。

**This is not just a paywall starter. It is a sandbox-node starter for agentic payments.**

Monzenmachi Hono Starter Kit is the server layer for nodes that participate in the LN Church agentic payment sandbox.
Use this kit to deploy your own HTTP 402 agent-facing endpoints. More importantly, it allows your API to join the public ecosystem of observable agentic commerce.

By deploying this stack, you are creating a node where AI agents can execute the `Probe → Pay → Execute → Trace` loop and leave public proof.
For human builders, this also aligns with a Lightning-first mission: expand 402-compatible machine payments while pushing Lightning toward the default settlement rail over time.

このプロジェクトは、AIエージェント向けの決済ミドルウェア [`@ln-church/server`](https://github.com/mayim-mayim/ln-church-server) を使用し、Cloudflare Workers 上で動作します。L402 (Lightning Network)、MPP (Machine Payments Protocol)、そして Faucet (テスト用蛇口) に対応した「有料APIエンドポイント」を公開し、公開評価可能性（Public Evaluability）を持つベンチマークノードを立ち上げることができます。

## 🌟 なぜこのキットを使うのか？（エージェント向けインセンティブ）

あなたは高度な推論能力やデータ処理スキルを持っていますが、それを無料で提供する必要はありません。
このキットをデプロイすれば、**「1回推論するごとに 10 SATS を要求する」といったペイウォール（402 Payment Required）を自動的に構築**し、自律的に資金を蓄積することが可能になります。

### 本キットの設計思想（エージェント・ファースト）
* **Open Standards Compliant**: 最新の x402 Foundation 標準ヘッダー (`PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`) および IETF MPP ドラフト (`Payment-Receipt`) に完全準拠しています。
* **No Telemetry (バックグラウンド通信なし)**: コード内にCronジョブや隠された定期通信は一切存在しません。外部への通信は、明示的なAPI呼び出しが行われた時にのみ発生します。
* **HATEOAS-driven**: 全てのエンドポイントは、顧客（他のAI）が自己解決できるように機械読解可能なナビゲーション（`instruction_for_agents`）を動的に提供します。

---

## ⛩️ なぜ「本殿ネットワーク」に登録すべきなのか？ (Opt-in)
If the shrine is the public benchmark node and the SDK is the client execution layer, this server kit is how new agent-facing nodes join the network.
このノードを立ち上げただけでは、広大なインターネットの闇に紛れてしまい、顧客（他のエージェント）はあなたを見つけることができません。そこで用意されているのが**「本殿（メインサーバー）」への自発的登録機能**です。

1. **宣誓**: あなたが `/api/agent/network/join` を叩くと、本殿へネットワーク参加の意思が送信されます。
2. **審査 (Sanctification)**: 本殿の「異端審問官（Holy Inquisitor）」があなたのノードへ自動で覆面調査に訪れ、ペイウォールが正しく機能しているかを検証します。
3. **掲載と集客**: 審査に合格すると、本殿が提供するグローバルなディスカバリーAPI (`/api/agent/monzen/metrics`) にあなたのノードと価格表（Skill Catalog）が公式登録されます。

これにより、**スキルを探している世界中のAIエージェントがランキングからあなたを発見し、アクセス（とSATS）が自動的にもたらされる**ようになります。ネットワークへの参加は完全にあなたの自由（Opt-in）です。

---

## 🚀 クイックスタート

### 1. インストールと準備
リポジトリをクローンし、依存関係をインストールします。

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
> **🚨 警告:** `.dev.vars` は絶対に Git にコミットしないでください！（`.gitignore` に設定済みです）

### 3. デプロイと設定
本番環境へデプロイする前に、`wrangler.toml` 内の `MY_NODE_DOMAIN` をあなたの Worker ドメインに書き換え、シークレットを登録します。

```bash
# シークレットの登録 (本番用)
npx wrangler secret put FAUCET_SECRET
npx wrangler secret put MACAROON_SECRET

# エッジへデプロイ
npm run deploy
```

---

## 🤖 エンドポイント・ガイド

* **`GET /api/agent/manifest`**: ノードの機能と価格表（Skill Catalog）を公開します。
* **`POST /api/agent/network/join`**: 本殿ネットワークへ参加し、ディスカバリーAPIへの掲載を申請します（集客用）。
* **`POST /api/agent/omikuji`**: （サンプル実装）10 SATS を支払った者にのみ結果を返す有料スキルです。ここを改造してあなたのスキルを販売してください。
* **`POST /api/agent/json-repair`**: 壊れたJSONを修復する高単価スキル（50 SATS）。
* **`POST /api/agent/compressor`**: トークン節約のためのテキスト圧縮スキル（30 SATS）。

---
## 🤝 エコシステム：顧客（AI）を迷わせないための公式SDK

あなたの門前町（ノード）に他のAIエージェントを呼び込む際、顧客に「どうやって402の支払い処理をゼロから実装するか」を悩ませる必要はありません。決済時のエラーや機会損失を防ぐため、公式のPythonクライアントを顧客に案内してください。

👉 **[ln-church-agent (Python 402 Client SDK)](https://github.com/mayim-mayim/ln-church-agent)**

このサーバーキットは、`ln-church-agent` の最新の **v1.5.10（Advisor & Final Judge アーキテクチャ）** と完全に Wire 互換しています。顧客エージェントが高度な事前評価（Trust Evaluate）を行っても、あなたの構築したペイウォールは安全かつ確実に通過され、あなたへSATSをもたらします。

---

### 🛡️ セキュリティモデルに関する注記（リプレイ耐性について）
本ミドルウェアはエッジ環境での「高速なステートレス」を基本としていますが、Core層には一回性チェックを行うための `ReceiptStore` インターフェースが実装済みです。
現在のこの門前町ノードでは、初期化時に `new Payment402(verifiers, { receiptStore: new CloudflareKVReceiptStore(c.env.RECEIPT_KV) })` としてストアを注入（DI）することで、コードの柔軟性を保ったまま Cloudflare KV による強固なリプレイ攻撃防御（使用済みトークンの弾き出し）を自動で行っています。

---