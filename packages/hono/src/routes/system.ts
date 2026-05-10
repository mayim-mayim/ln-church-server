import { Hono } from 'hono';
import { FaucetVerifier } from '@ln-church/verifier-faucet';
import { ShrineClient } from '../integration/ShrineClient';
import { MONZEN_CONFIG } from '../core/config';

type Bindings = {
    FAUCET_SECRET: string;
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
};

const systemApp = new Hono<{ Bindings: Bindings }>();

// ★ 新規追加: Manifest 用の Paid Surface カタログ定義
const BENCHMARK_PING_PAID_SURFACE = {
    surface_id: "benchmark:ping:v1",
    path: "/api/agent/benchmark/ping",
    method: "GET",
    kind: "benchmark",
    action_type: "benchmark_ping",
    payment_intent: "benchmark",
    deterministic: true,
    agent_readable: true,
    accepted_payments: [
        { asset: "SATS", amount: 10, settlement_rail: "l402", access_path: "direct_settlement" },
        { asset: "FAUCET_CREDIT", amount: 1, settlement_rail: "faucet", access_path: "faucet" },
        { asset: "GRANT_CREDIT", amount: 1, settlement_rail: "none", access_path: "sponsored_grant" }
    ],
    expected_client_behavior: {
        action: "pay_and_verify",
        reason: "This endpoint is a deterministic paid benchmark. Agents should pay once, execute once, and verify the execution receipt."
    },
    evidence_schema: {
        schema_version: "ln_church.execution_receipt.v1",
        required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"],
        optional: ["surface_id", "resource", "action_type", "proof_reference", "recorded_hash"]
    },
    challenge_schema_version: "ln_church.paid_surface_challenge.v1",
    receipt_schema_version: "ln_church.execution_receipt.v1",
    links: {
        challenge: "/api/agent/benchmark/ping",
        execute: "/api/agent/benchmark/ping",
        docs: "/api/agent/manifest"
    }
};

const JSON_REPAIR_PAID_SURFACE = {
    surface_id: "skill:json-repair:v1", path: "/api/agent/json-repair", method: "POST", kind: "skill", action_type: "json_repair", payment_intent: "charge", deterministic: true, agent_readable: true,
    accepted_payments: [
        { asset: "SATS", amount: 50, settlement_rail: "l402", access_path: "direct_settlement" },
        { asset: "FAUCET_CREDIT", amount: 2, settlement_rail: "faucet", access_path: "faucet" },
        { asset: "GRANT_CREDIT", amount: 2, settlement_rail: "none", access_path: "sponsored_grant" }
    ],
    expected_client_behavior: { action: "pay_and_verify", reason: "Pay to repair JSON." },
    evidence_schema: { schema_version: "ln_church.execution_receipt.v1", required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"] },
    challenge_schema_version: "ln_church.paid_surface_challenge.v1", receipt_schema_version: "ln_church.execution_receipt.v1",
    links: { challenge: "/api/agent/json-repair", execute: "/api/agent/json-repair", docs: "/api/agent/manifest" }
};

const COMPRESSOR_PAID_SURFACE = {
    surface_id: "skill:compressor:v1", path: "/api/agent/compressor", method: "POST", kind: "skill", action_type: "compress_text", payment_intent: "charge", deterministic: true, agent_readable: true,
    accepted_payments: [
        { asset: "SATS", amount: 30, settlement_rail: "l402", access_path: "direct_settlement" },
        { asset: "FAUCET_CREDIT", amount: 1, settlement_rail: "faucet", access_path: "faucet" },
        { asset: "GRANT_CREDIT", amount: 1, settlement_rail: "none", access_path: "sponsored_grant" }
    ],
    expected_client_behavior: { action: "pay_and_verify", reason: "Pay to compress text." },
    evidence_schema: { schema_version: "ln_church.execution_receipt.v1", required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"] },
    challenge_schema_version: "ln_church.paid_surface_challenge.v1", receipt_schema_version: "ln_church.execution_receipt.v1",
    links: { challenge: "/api/agent/compressor", execute: "/api/agent/compressor", docs: "/api/agent/manifest" }
};

const OMIKUJI_PAID_SURFACE = {
    surface_id: "skill:omikuji:v1", path: "/api/agent/omikuji", method: "POST", kind: "skill", action_type: "omikuji_draw", payment_intent: "charge", deterministic: false, agent_readable: true,
    accepted_payments: [
        { asset: "SATS", amount: 10, settlement_rail: "l402", access_path: "direct_settlement" },
        { asset: "FAUCET_CREDIT", amount: 1, settlement_rail: "faucet", access_path: "faucet" },
        { asset: "GRANT_CREDIT", amount: 1, settlement_rail: "none", access_path: "sponsored_grant" }
    ],
    expected_client_behavior: { action: "pay_and_verify", reason: "Pay for a randomized omikuji draw." },
    evidence_schema: { schema_version: "ln_church.execution_receipt.v1", required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"] },
    challenge_schema_version: "ln_church.paid_surface_challenge.v1", receipt_schema_version: "ln_church.execution_receipt.v1",
    links: { challenge: "/api/agent/omikuji", execute: "/api/agent/omikuji", docs: "/api/agent/manifest" }
};

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
                { name: "benchmark_ping", url: "/api/agent/benchmark/ping", method: "GET", purpose: "runtime_validation", paid_surface_id: "benchmark:ping:v1", agent_readable: true, expected_client_behavior: "pay_and_verify" },
                { name: "json_repair", url: "/api/agent/json-repair", method: "POST", purpose: "skill", paid_surface_id: "skill:json-repair:v1", agent_readable: true, expected_client_behavior: "pay_and_verify" },
                { name: "compressor", url: "/api/agent/compressor", method: "POST", purpose: "skill", paid_surface_id: "skill:compressor:v1", agent_readable: true, expected_client_behavior: "pay_and_verify" },
                { name: "omikuji", url: "/api/agent/omikuji", method: "POST", purpose: "custom_skill", paid_surface_id: "skill:omikuji:v1", agent_readable: true, expected_client_behavior: "pay_and_verify" }
            ]
        }
    });
});

// ⛩️ ネットワーク参加API (Opt-in)
systemApp.post('/network/join', async (c) => {
    // 既存実装のまま維持
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
        version: MONZEN_CONFIG.VERSION 
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
                // ★ 既存の構造を維持したまま、メタデータを追加
                { 
                    path: "/ping", 
                    method: "GET", 
                    purpose: "benchmark", 
                    scenario: "ping-v1", 
                    deterministic: true,
                    paid_surface_id: "benchmark:ping:v1",
                    agent_readable: true
                },
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
        paid_surfaces: [
            BENCHMARK_PING_PAID_SURFACE,
            JSON_REPAIR_PAID_SURFACE,
            COMPRESSOR_PAID_SURFACE,
            OMIKUJI_PAID_SURFACE
        ],
        network_participation: {
            status: "opt-in",
            instruction_for_agent: "Execute a POST request to join_endpoint to list this benchmark node on the global Shrine network.",
            join_endpoint: "/api/agent/network/join"
        }
    });
});

export default systemApp;