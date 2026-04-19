# ⛩️ Monzenmachi Benchmark Provider Starter

> **Reference benchmark provider starter for agent-facing 402 APIs.** > AIエージェントが「支払いと実行の整合性」を検証するための、公開評価可能性（Public Evaluability）を備えた参照ノード・スターターキットです。

This repository is NOT just a paywall template. It is a **reference benchmark surface** designed for the modern agentic economy. By deploying this stack, you provide a stable environment where AI agents can execute the `Probe → Pay → Execute → Trace` loop with deterministic benchmark responses for runtime validation.

## 🌟 Core Value: Public Evaluability
For an autonomous agent to trust and use a paid API, it must first validate the provider's runtime. Monzenmachi focuses on providing **deterministic benchmark outcomes** that allow buyer-side runtimes to verify the 402 handshake, replay protection, and payload integrity before committing to complex computational tasks.

* **Reference Provider Surface**: A deployable standard for agent-facing 402 endpoints.
* **Buyer-side Runtime Validation**: Built-in endpoints to verify the payment protocol stack.
* **Standard Protocols**: Compliant with L402, IETF MPP draft, and x402 Foundation standard headers.
* **Network Participation is Optional**: Operates as a fully autonomous benchmark node by default.

---

## 🤖 1. Reference Benchmark Suite
Before serving complex skills, a provider must prove its protocol reliability. These endpoints provide deterministic responses and are optimized for machine-facing runtime interop testing.

* **`GET /api/agent/benchmark/ping`**
    - **Purpose**: Minimal paid GET for connectivity and 402 handshake testing.
    - **Price**: 10 SATS / 1 Faucet Credit.
* **`POST /api/agent/benchmark/echo`**
    - **Purpose**: Validates payload integrity and POST-retry logic. Returns the input text and its metadata.
    - **Price**: 10 SATS / 1 Faucet Credit.

## 🛠️ 2. Computational Skill Catalog
On top of the benchmark layer, you can host specialized computational skills. This kit includes example "ritual" skills to demonstrate asset-based pricing.

* **`POST /api/agent/omikuji`**: A randomized oracle service (10 SATS).
* **`POST /api/agent/json-repair`**: High-value algorithmic repair service for mangled JSON (50 SATS).
* **`POST /api/agent/compressor`**: Smart token-reduction service for LLM context optimization (30 SATS).

---

## 🚀 Quickstart

### 1. Environment Setup
Clone the repository and install dependencies.

```bash
cd examples/hono-app
npm install
```

### 2. Configuration & Bindings
Create a `.dev.vars` file in `examples/hono-app/` for local secrets. Ensure your `wrangler.toml` includes a `RECEIPT_KV` binding for replay protection.

```text
# .dev.vars
FAUCET_SECRET="your-local-test-faucet-secret"
MACAROON_SECRET="your-local-test-macaroon-secret"
```

### 3. Deployment
```bash
# Set secrets on production
npx wrangler secret put FAUCET_SECRET
npx wrangler secret put MACAROON_SECRET

# Deploy to the edge
npm run deploy
```

---

## ⛩️ 3. Shrine Network Participation (Opt-in)
If you wish to make your node discoverable by the global agent network, you can voluntarily participate in the Shrine network.

1. **Join Request**: Execute `POST /api/agent/network/join` to notify the Main Shrine.
2. **Sanctification**: The "Holy Inquisitor" will visit your benchmark endpoints to verify protocol compliance.
3. **Public Metrics**: Once verified, your node and skill catalog will be listed in the global discovery API.

---

## 🤝 Ecosystem: Official SDK
To ensure seamless integration for your customers (AI agents), recommend the official Python client:  
👉 **[ln-church-agent (Python 402 Client SDK)](https://github.com/mayim-mayim/ln-church-agent)**

## 🛡️ Security: Replay Protection
This kit implements an edge-native `ReceiptStore` using **Cloudflare KV**. Every payment receipt is checked and stored to prevent double-spending and replay attacks, ensuring your computational resources are never consumed for free.

---