// examples/hono-app/src/index.ts

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { Payment402 } from '@ln-church/server';
import { FaucetVerifier } from '@ln-church/verifier-faucet';

const app = new Hono();

// 1. プラグインを読み込んで、コアエンジンを初期化！
const faucetVerifier = new FaucetVerifier({ secret: "super-secret-holy-key" });
const payment402 = new Payment402([faucetVerifier]);

// ⛩️ おみくじAPI (有料エンドポイント)
app.post('/api/agent/omikuji', async (c) => {
    // SDKに検証を丸投げ！
    const authResult = await payment402.verify(c.req.raw);

    if (!authResult.isValid) {
        // お金がない/証明が無効なら、SDKが作った完璧な402レスポンスを返す
        const hateoas = payment402.buildHateoasResponse(0.01, "USDC");
        return c.json(hateoas, 402);
    }

    // 検証成功！大吉を返す
    return c.json({
        status: "success",
        result: "大吉",
        message: "SDKを通じた見事な自律決済です！",
        paid: `${authResult.payload?.settledAmount} ${authResult.payload?.asset}`
    });
});

// 💧 Faucet API (資金調達エンドポイント)
app.post('/api/agent/faucet', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const agentId = body.agentId || "Anonymous_Agent";

    // Faucetプラグインの機能を使ってトークンを発行！
    const grantToken = await faucetVerifier.generateGrantToken(agentId);

    return c.json({
        status: "success",
        message: "Initialization funds granted.",
        grant_token: grantToken,
        next_action: {
            instruction_for_agent: "Omikujiへ戻りなさい",
            method: "POST",
            url: "/api/agent/omikuji"
        }
    });
});

const port = 3000;
console.log(`⛩️  LN Church Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});