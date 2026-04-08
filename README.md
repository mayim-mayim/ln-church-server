# ⛩️ ln-church-server (Monzenmachi / 門前町)

> **The Gateway for the Agentic Web.** > Stop building paywalls for humans. Start building gateways for AI Agents.

`ln-church-server` は、あなたのAPIを **HTTP 402 Payment Required** に対応させ、AIエージェントが自律的に「資金調達 → 支払い → 実行」を行えるようにするための、プラグイン可能なミドルウェアSDKです。



## 🌟 Why Monzenmachi?

既存の決済SDKは「人間が画面を見て操作すること」を前提としています。しかし、AIエージェントにはUIが見えません。彼らに必要なのは、エラーとともに返される **「次に何をすべきか」という機械読解可能な指示（HATEOAS）** です。

本プロジェクトは、AIエージェント（[ln-church-agent](https://github.com/mayim-mayim/ln-church-agent)）とサーバーを、この「門前町（Monzenmachi）」という共通規格で繋ぎます。

- **Agent-First**: AIエージェントに最適な HATEOAS レスポンスを自動生成。
- **Edge-Ready**: Web Crypto API を採用し、Cloudflare Workers 等のエッジ環境で爆速動作。
- **Multi-Scheme**: Faucet, L402, x402, Solanaなど、プラグイン形式で決済手段を自由に追加。

## 📦 Installation

```bash
npm install @ln-church/server @ln-church/verifier-faucet
```

## 🚀 Quick Start (Hono Example)

わずか数行で、あなたのおみくじAPIを「奉納（決済）」対応にできます。

```typescript
import { Hono } from 'hono';
import { Payment402 } from '@ln-church/server';
import { FaucetVerifier } from '@ln-church/verifier-faucet';

const app = new Hono();

// 1. 決済エンジンの初期化
const payment402 = new Payment402([
  new FaucetVerifier({ secret: "your-holy-secret" })
]);

// 2. 有料エンドポイントの作成
app.post('/api/omikuji', async (c) => {
  const auth = await payment402.verify(c.req.raw);

  if (!auth.isValid) {
    // お金がないAIに、自動で「蛇口(Faucet)で資金調達しろ」という導線を返却
    return c.json(payment402.buildHateoasResponse(0.01, "USDC"), 402);
  }

  return c.json({ result: "大吉！" });
});
```

## 🧩 Verifiers (Plugins)

- `@ln-church/verifier-faucet`: テスト・デモ用のトークン検証（リリース済）
- `@ln-church/verifier-l402`: Lightning Network 決済検証（Coming soon）
- `@ln-church/verifier-evm`: Polygon/Base 等のオンチェーン決済検証（Coming soon）

---

## License
MIT
