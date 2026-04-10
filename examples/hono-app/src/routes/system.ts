// src/routes/system.ts
import { Hono } from 'hono';
import { FaucetVerifier } from '@ln-church/verifier-faucet';

type Bindings = {
    FAUCET_SECRET: string;
};

const systemApp = new Hono<{ Bindings: Bindings }>();

// 💧 Faucet API (GET/POST両対応にしておくとエージェントに優しいです)
systemApp.all('/faucet', async (c) => {
    const faucetVerifier = new FaucetVerifier({ secret: c.env.FAUCET_SECRET });
    let agentId = "Anonymous_Agent";
    
    if (c.req.method === 'POST') {
        const body = await c.req.json().catch(() => ({}));
        if (body.agentId) agentId = body.agentId;
    }

    const grantToken = await faucetVerifier.generateGrantToken(agentId);

    return c.json({
        status: "success",
        message: "Initialization funds granted. (Test Token)",
        grant_token: grantToken,
        next_action: {
            instruction_for_agent: "Use this token to bypass the L402 challenge on our skill endpoints.",
            capabilities: [ { name: "omikuji", url: "/api/agent/omikuji", method: "POST" } ]
        }
    });
});

// 📜 Manifest API (機能一覧の開示)
systemApp.get('/manifest', (c) => {
    return c.json({
        node_name: "Monzenmachi Outpost",
        version: "1.0.0",
        description: "An autonomous L402-protected node offering specific computational skills.",
        capabilities: [
            { id: "omikuji", path: "/api/agent/omikuji", method: "POST", price_estimate: "10 SATS" }
            // 将来ここに Token Compressor 等を追加していきます
        ]
    });
});

export default systemApp;