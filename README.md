# ⛩️ Monzenmachi Benchmark Provider Starter

> **Reference benchmark provider starter for agent-facing 402 APIs.**
> AIエージェントが「支払いと実行の整合性」を検証するための、公開評価可能性（Public Evaluability）を備えた参照ノード・スターターキットです。

This repository is NOT just a paywall template. It is a **reference benchmark surface** designed for the modern agentic economy. By deploying this stack, you provide a stable environment where AI agents can execute the `Probe → Pay → Execute → Trace` loop with deterministic benchmark responses for runtime validation.

**This server now supports both direct HTTP 402 settlement and trusted sponsor-funded grant overrides through the same execution surface.**

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
    - **Price**: 10 SATS / 1 Faucet Credit / 1 Grant Credit (if valid and in scope)
* **`POST /api/agent/benchmark/echo`**
    - **Purpose**: Validates payload integrity and POST-retry logic. Returns the input text and its metadata.
    - **Price**: 10 SATS / 1 Faucet Credit / 1 Grant Credit (if valid and in scope)

## 🛠️ 2. Computational Skill Catalog
On top of the benchmark layer, you can host specialized computational skills. This kit includes example "ritual" skills to demonstrate asset-based pricing.

* **`POST /api/agent/omikuji`**: A randomized oracle service (10 SATS).
* **`POST /api/agent/json-repair`**: High-value algorithmic repair service for mangled JSON (50 SATS).
* **`POST /api/agent/compressor`**: Smart token-reduction service for LLM context optimization (30 SATS).

---

## 🎟️ 3. Sponsored Grant Override (Experimental)

In addition to direct HTTP 402 settlement (x402, L402, MPP), `ln-church-server` can accept a **signed, scoped, single-use grant override** as a pre-payment access path.

This mechanism is designed for **sponsor-funded access experiments** in A2A markets, where an agent may execute before direct settlement by presenting a trusted grant token.

### Core Properties
- **Transport**: `paymentOverride.type = "grant"` with `asset = "GRANT_CREDIT"`
- **Token Format**: JWS
- **Key Distribution**: JWKS with `kid` support
- **Signature Support**: Ed25519 / OKP
- **Validation**:
  - Trusted issuer check
  - Audience check
  - Route/method scope check
  - Canonical agent ID binding
  - Single-use / replay protection

### Positioning
This is **not** a replacement for direct x402/L402/MPP settlement. It is an experimental **pre-payment distribution layer** that feeds into the same paid execution runtime.

### Important Boundary
`ln-church-server` does **not** assume LN Church as the only issuer. Any trusted issuer may be accepted if its keys are resolvable and its grants satisfy the server's verification policy.

### Example: Grant Override Request

```json
{
  "agentId": "0x1234...",
  "clientType": "AI",
  "scheme": "L402",
  "asset": "SATS",
  "paymentOverride": {
    "type": "grant",
    "proof": "<JWS_GRANT_TOKEN>",
    "asset": "GRANT_CREDIT"
  }
}
```

*If the grant is valid for the route, method, audience, and canonical agent ID, the server will unlock the paid endpoint and return a normal execution receipt.*

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

## ⛩️ 4. Shrine Network Participation (Opt-in)
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