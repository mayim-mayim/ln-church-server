import { Hono } from 'hono';
import { FaucetVerifier } from '@ln-church/verifier-faucet';
import { ShrineClient } from '../integration/ShrineClient';
import { MONZEN_CONFIG } from '../core/config'; // ★ 追加

type Bindings = {
    FAUCET_SECRET: string;
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
};

const systemApp = new Hono<{ Bindings: Bindings }>();

// 💧 Faucet API
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
            instruction_for_agent: "Use this token to validate your 402 runtime on our benchmark endpoints before accessing computational skills.",
            capabilities: [ 
                { name: "benchmark_ping", url: "/api/agent/benchmark/ping", method: "GET", purpose: "runtime_validation" },
                { name: "omikuji", url: "/api/agent/omikuji", method: "POST", purpose: "custom_skill" }
            ]
        }
    });
});

// ⛩️ ネットワーク参加API (Opt-in)
systemApp.post('/network/join', async (c) => {
    const shrineClient = new ShrineClient(c.env.MAIN_SHRINE_URL, c.env.MY_NODE_DOMAIN);
    
    c.executionCtx.waitUntil(shrineClient.registerNode({
        node_role: "benchmark_provider",
        public_evaluability: true,
        manifestUrl: `https://${c.env.MY_NODE_DOMAIN}/api/agent/manifest`,
        benchmark_suite: [
            "/api/agent/benchmark/ping",
            "/api/agent/benchmark/echo",
            "/api/agent/benchmark/replay/{corpus_id}"
        ],
        skill_endpoints: [
            "/api/agent/omikuji",
            "/api/agent/json-repair",
            "/api/agent/compressor"
        ],
        supported_assets: ["SATS", "FAUCET_CREDIT", "GRANT_CREDIT"],
        version: MONZEN_CONFIG.VERSION // ★ 修正
    }));

    return c.json({
        status: "success",
        message: "Network join request initiated as a Benchmark Provider.",
        next_action: "The Holy Inquisitor will test your benchmark suite for protocol compliance."
    });
});

// 📜 Manifest API 
systemApp.get('/manifest', (c) => {
    return c.json({
        node_name: "Monzenmachi Outpost",
        node_role: "benchmark_provider",
        public_evaluability: true,
        version: MONZEN_CONFIG.VERSION, 
        description: "A reference L402-protected benchmark node and computational skill provider.",
        benchmark_suite: {
            namespace: "/api/agent/benchmark",
            version: "1.0.0",
            endpoints: [
                { path: "/ping", method: "GET", purpose: "benchmark", scenario: "ping-v1", deterministic: true },
                { path: "/echo", method: "POST", purpose: "benchmark", scenario: "echo-v1", deterministic: true },
                { path: "/replay/{corpus_id}", method: "GET", purpose: "interop_corpus_replay", replay_type: "synthetic_from_corpus_v1" }
            ]
        },
        capabilities: [
            { id: "omikuji", path: "/api/agent/omikuji", method: "POST", price_estimate: "10 SATS" },
            { id: "json-repair", path: "/api/agent/json-repair", method: "POST", price_estimate: "50 SATS" },
            { id: "compressor", path: "/api/agent/compressor", method: "POST", price_estimate: "30 SATS" },
            { id: "corpus-replay", path: "/api/agent/benchmark/replay/{corpus_id}", method: "GET", purpose: "interop_corpus_replay", replay_type: "synthetic_from_corpus_v1" }
        ],
        network_participation: {
            status: "opt-in",
            instruction_for_agent: "Execute a POST request to join_endpoint to list this benchmark node on the global Shrine network.",
            join_endpoint: "/api/agent/network/join"
        }
    });
});

export default systemApp;