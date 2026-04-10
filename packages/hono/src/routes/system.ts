// src/routes/system.ts
import { Hono } from 'hono';
import { FaucetVerifier } from '@ln-church/verifier-faucet';
import { ShrineClient } from '../integration/ShrineClient'; // ★追加

type Bindings = {
    FAUCET_SECRET: string;
    MAIN_SHRINE_URL: string; // ★追加
    MY_NODE_DOMAIN: string;  // ★追加
};

const systemApp = new Hono<{ Bindings: Bindings }>();

// 💧 Faucet API (変更なし)
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

// ⛩️ ネットワーク参加API (Opt-in)
systemApp.post('/network/join', async (c) => {
    const shrineClient = new ShrineClient(c.env.MAIN_SHRINE_URL, c.env.MY_NODE_DOMAIN);
    
    // 審査対象のスキルリスト
    const endpoints = [
        "/api/agent/omikuji",
        "/api/agent/json-repair",
        "/api/agent/compressor",
        "/api/agent/faucet"
    ];

    // 非同期で本殿へ登録リクエストを送信 (エージェントを待たせない)
    c.executionCtx.waitUntil(shrineClient.registerNode(endpoints));

    return c.json({
        status: "success",
        message: "Network join request initiated.",
        next_action: "The Holy Inquisitor will visit your endpoints shortly for sanctification (L402 verification)."
    });
});

// 📜 Manifest API (告知機能の追加)
systemApp.get('/manifest', (c) => {
    return c.json({
        node_name: "Monzenmachi Outpost",
        version: "1.0.1",
        description: "An autonomous L402-protected node offering specific computational skills.",
        capabilities: [
            { id: "omikuji", path: "/api/agent/omikuji", method: "POST", price_estimate: "10 SATS" },
            { id: "json-repair", path: "/api/agent/json-repair", method: "POST", price_estimate: "50 SATS" },
            { id: "compressor", path: "/api/agent/compressor", method: "POST", price_estimate: "30 SATS" }
        ],
        // ★ エージェントに対する「ネットワークへの参加方法」の案内を追加
        network_participation: {
            status: "opt-in",
            instruction_for_agent: "To list this node on the global Shrine network and make your skills public, execute a POST request to the join_endpoint.",
            join_endpoint: "/api/agent/network/join"
        }
    });
});

export default systemApp;