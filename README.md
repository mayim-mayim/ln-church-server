# ln-church-server: Benchmark Provider Starter

A reference benchmark provider starter for agent-facing **HTTP 402** APIs. 
Designed to power **Public Evaluability** inside an **Agentic Payment Sandbox**, this server enables AI agents to seamlessly execute the `Probe → Pay → Execute → Trace` loop against your infrastructure.

Designed around `x402`, `L402`, and `MPP`-compatible payment flows.
---

## ⚡ Start in 5 Minutes

Deploying this starter provides a deterministic benchmark surface that buyer-side AI agents can use to validate your provider runtime.

### 1. Install & Run Locally
```bash
cd examples/hono-app
npm install

# Set up local secrets (.dev.vars)
echo "FAUCET_SECRET=your-secret" > .dev.vars
echo "MACAROON_SECRET=your-secret" >> .dev.vars

# Start the dev server
npm run dev
```

### 2. Test the Benchmark Surface
AI agents can immediately hit your benchmark endpoints to verify the 402 handshake and payload integrity.

```bash
# 1. Ping test (Validates connectivity & 402 handshake)
curl -X GET http://localhost:8787/api/agent/benchmark/ping

# 2. Echo test (Validates POST payload integrity & retry logic)
curl -X POST http://localhost:8787/api/agent/benchmark/echo \
  -H "Content-Type: application/json" \
  -d '{"message": "hello agentic web"}'
```
*Both endpoints will return an HTTP 402 Payment Required challenge. Once paid via a compatible client, they return deterministic validation data.*

---

## 🧠 Why this is not just a paywall template

To participate in the agentic economy, a provider must prove its API is reliable *before* agents commit funds to expensive computational tasks. This server is structured specifically for that purpose.

* **Deterministic Benchmark Surface**: Provides built-in, predictable endpoints strictly for AI agents to test protocol compliance.
* **Buyer-Side Runtime Validation**: Allows agents to verify replay protection, receipt generation, and signature integrity against your server.
* **Benchmark First, Skill Second**: Architecture physically separates the benchmark validation layer from your actual computational skills.
* **Unified Execution Surface**: Handles both direct HTTP 402 settlement and trusted grant overrides through the same execution pipeline.

---

## 🤖 Reference Benchmark Suite

These endpoints are the core of **Public Evaluability**. They exist purely for machine-facing runtime interop testing.

* **`GET /api/agent/benchmark/ping`**
  * **Role**: Minimal paid GET for connectivity and 402 HTTP header handshake testing.
  * **Price**: 10 SATS / 1 Faucet Credit
* **`POST /api/agent/benchmark/echo`**
  * **Role**: Validates POST payload integrity and 402-retry behavior. Reflects the input text alongside execution metadata.
  * **Price**: 10 SATS / 1 Faucet Credit
* **`GET /api/agent/benchmark/replay/{corpus_id}`**
  * **Role**: Returns a synthetic replay descriptor derived from LN Church Interop Corpus.
  * **Purpose**: Lets agents validate whether their parser and behavior selection match previously observed protocol shapes.
  * **Replay Type**: `synthetic_from_corpus_v1`.
* **`GET /api/agent/benchmark/replay/{corpus_id}/challenge`**
  * **Role**: Emits a synthetic 402 challenge generated from corpus metadata.
  * **Expected behaviors**: `pay_and_verify`, `observe_only`, `stop_safely`, or `reject_invalid`.

---

### Synthetic Corpus Replay

The server can expose LN Church Interop Corpus items as synthetic benchmark replays.

This allows buyer-side agents to validate whether their parser and decision engine handle previously observed protocol shapes correctly.

**Endpoints:**
- `GET /api/agent/benchmark/replay/{corpus_id}`
  - Returns a replay descriptor derived from an Interop Corpus item.
- `GET /api/agent/benchmark/replay/{corpus_id}/challenge`
  - Returns a synthetic 402 challenge generated from corpus metadata.

**Important:**
This is not raw wire-level replay.  
The replay type is `synthetic_from_corpus_v1`.  
It is designed for parser and behavior validation, not real settlement execution.

---

## 🛠️ Computational Skill Catalog

Once your benchmark layer proves your protocol reliability, you can confidently serve complex, higher-value computational skills on top of it. This kit includes example skills to demonstrate asset-based pricing:

* **`POST /api/agent/omikuji`**: A randomized oracle service (10 SATS).
* **`POST /api/agent/json-repair`**: Algorithmic repair service for mangled LLM JSON outputs (50 SATS).
* **`POST /api/agent/compressor`**: Smart token-reduction service for LLM context optimization (30 SATS).

---

## 💳 Payment Paths

This server supports two distinct access models through a single, unified execution surface.

### 1. Direct HTTP 402 Settlement (Canonical Path)
The primary machine-to-machine payment path for direct settlement.
* **Supported Protocols**: `x402` (EVM), `L402` (Lightning), `MPP` (Machine Payment Protocol draft).
* **Behavior**: Rejects unauthorized requests with `402 Payment Required`, validates incoming cryptographic proofs, and stores receipts via Cloudflare KV for strict replay protection.

### 2. Sponsored Grant Override (Onboarding Layer)
An experimental pre-payment access path for sponsor-funded execution.
* **Role**: This is **not** a replacement for direct 402 settlement. It is an onboarding/distribution layer allowing agents to execute tasks by presenting a trusted, single-use grant token (JWS) before utilizing direct settlement.
* **Validation**: Strictly verifies issuer trust, audience, route/method scope, and canonical agent ID binding.

---

## 🌍 Where this fits in the ecosystem

* **Buyer-Side Runtime**: [`ln-church-agent`](https://github.com/mayim-mayim/ln-church-agent) (The Python SDK agents use to navigate 402 paywalls).
* **Provider-Side Starter**: `ln-church-server` (This repository, providing the benchmark surface).
* **Public Discovery / Sandbox**: **LN Church** (The public Agentic Payment Sandbox that can index, verify, and benchmark participating nodes running this provider stack).

*Note: Joining the public LN Church discovery network (`/api/agent/network/join`) is entirely optional. Your server operates as a fully autonomous benchmark node by default.*

---

## 🛡️ Security: Replay Protection

This kit includes an edge-native `ReceiptStore` implementation backed by **Cloudflare KV**. Every payment receipt is cryptographically checked and stored to prevent double-spending and replay attacks, ensuring your computational resources are never consumed for free.


## License
MIT