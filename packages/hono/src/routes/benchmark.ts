import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { getPayment402 } from '../core/payment';
import { ShrineClient } from '../integration/ShrineClient';
import type { PaidSurfaceRequirement } from '@ln-church/server'; // ★ 追加

type Bindings = {
    FAUCET_SECRET: string;
    MACAROON_SECRET: string;
    RECEIPT_KV: KVNamespace;
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
};

const benchmarkApp = new Hono<{ Bindings: Bindings }>();

// 共通設定: 既存のレガシー Requirement（echo等で使用）
const BENCH_REQUIREMENTS = [
    { amount: 10, asset: "SATS" }, 
    { amount: 1, asset: "FAUCET_CREDIT" }, 
    { amount: 1, asset: "GRANT_CREDIT" }
];

// ★ 新規追加: /ping 専用の Paid Surface Requirement
const BENCH_PING_REQUIREMENTS: PaidSurfaceRequirement[] = [
    {
        amount: 10,
        asset: "SATS",
        surface: {
            surface_id: "benchmark:ping:v1",
            resource: "/api/agent/benchmark/ping",
            action_type: "benchmark_ping",
            payment_intent: "benchmark",
            settlement_rail: "l402",
            access_path: "direct_settlement",
            deterministic: true,
            description: "Deterministic paid GET endpoint for validating agent-side HTTP 402 runtime behavior.",
            expected_client_behavior: {
                action: "pay_and_verify",
                reason: "This endpoint is a deterministic paid benchmark. Agents should pay once, execute once, and verify the execution receipt."
            },
            evidence_schema: {
                schema_version: "ln_church.execution_receipt.v1",
                required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"],
                optional: ["surface_id", "resource", "action_type", "proof_reference", "recorded_hash"]
            },
            output_schema: {
                type: "object",
                required: ["status", "kind", "scenario", "result", "deterministic", "execution_receipt"],
                properties: {
                    status: { type: "string" },
                    kind: { type: "string" },
                    scenario: { type: "string" },
                    result: { type: "string" },
                    deterministic: { type: "boolean" },
                    execution_receipt: { type: "object" }
                }
            }
        }
    },
    {
        amount: 1,
        asset: "FAUCET_CREDIT",
        surface: {
            surface_id: "benchmark:ping:v1",
            resource: "/api/agent/benchmark/ping",
            action_type: "benchmark_ping",
            payment_intent: "benchmark",
            settlement_rail: "faucet",
            access_path: "faucet",
            deterministic: true,
            expected_client_behavior: {
                action: "pay_and_verify",
                reason: "Faucet credit is accepted for benchmark validation."
            },
            evidence_schema: {
                schema_version: "ln_church.execution_receipt.v1",
                required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"]
            }
        }
    },
    {
        amount: 1,
        asset: "GRANT_CREDIT",
        surface: {
            surface_id: "benchmark:ping:v1",
            resource: "/api/agent/benchmark/ping",
            action_type: "benchmark_ping",
            payment_intent: "sponsored_access",
            settlement_rail: "none",
            access_path: "sponsored_grant",
            deterministic: true,
            expected_client_behavior: {
                action: "pay_and_verify",
                reason: "Scoped grant access is accepted as sponsored benchmark access without direct settlement."
            },
            evidence_schema: {
                schema_version: "ln_church.execution_receipt.v1",
                required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"]
            }
        }
    }
];

/**
 * A. GET /ping
 * 最小の決定論的 Paid GET (Agent-Readable Paid Surface 適用済み)
 */
benchmarkApp.get('/ping', async (c) => {
    const p402 = getPayment402(c);
    // ★ 検証に Paid Surface 情報を渡す
    const auth = await p402.verify(c.req.raw, BENCH_PING_REQUIREMENTS);

    if (!auth.isValid) {
        // ★ 402 の body は Paid Surface Challenge、header はレガシー互換を維持
        return c.json(
            p402.buildPaidSurfaceChallenge(BENCH_PING_REQUIREMENTS), 
            402, 
            p402.buildChallengeHeaders(BENCH_PING_REQUIREMENTS)
        );
    }

    const receiptToken = btoa(JSON.stringify({ scenario: "ping-v1", ts: Date.now() }));
    
    // ★ 実行証跡 (Execution Receipt) の構築
    const executionReceipt = p402.buildExecutionReceipt({
        requirement: BENCH_PING_REQUIREMENTS.find(
            req => req.asset === auth.payload?.asset
        ) || BENCH_PING_REQUIREMENTS[0],
        authResult: auth,
        verification_method: "server_receipt_v1",
        recorded_hash: "benchmark:ping:v1:ok",
        result: {
            deterministic: true,
            output_hash: "benchmark:ping:v1:ok",
            output_schema: {
                type: "object",
                required: ["status", "kind", "scenario", "result", "deterministic"]
            }
        }
    });

    // ★ 既存の JSON 構造を壊さずに execution_receipt をマージ
    return c.json({
        status: "success",
        kind: "benchmark_result",
        scenario: "ping-v1",
        result: "ok",
        deterministic: true,
        execution_receipt: executionReceipt
    }, 200, p402.buildSuccessReceiptHeaders(receiptToken));
});

/**
 * B. POST /echo
 * ボディの整合性を検証するための決定論的 Paid POST
 */
benchmarkApp.post('/echo', async (c) => {
    const p402 = getPayment402(c);
    const auth = await p402.verify(c.req.raw, BENCH_REQUIREMENTS);

    if (!auth.isValid) {
        return c.json(p402.buildHateoasResponse(BENCH_REQUIREMENTS), 402, p402.buildChallengeHeaders(BENCH_REQUIREMENTS));
    }

    const body = await c.req.json().catch(() => ({}));
    const text = body.text || "";

    const receiptToken = btoa(JSON.stringify({ scenario: "echo-v1", hash: btoa(text).slice(0, 8) }));
    return c.json({
        status: "success",
        kind: "benchmark_result",
        scenario: "echo-v1",
        result: {
            text: text,
            length: text.length
        },
        deterministic: true
    }, 200, p402.buildSuccessReceiptHeaders(receiptToken));
});

/**
 * C. GET /replay/:corpus_id
 * 本殿から Corpus Item を取得し、descriptor として返す (無料)
 * ※ raw exact replay ではなく synthetic replay from corpus v1
 */
benchmarkApp.get('/replay/:corpus_id', async (c) => {
    const corpusId = c.req.param('corpus_id');
    const shrineClient = new ShrineClient(c.env.MAIN_SHRINE_URL, c.env.MY_NODE_DOMAIN);
    
    const corpusItem = await shrineClient.fetchCorpusItem(corpusId);
    if (!corpusItem) {
        return c.json({ status: "error", message: "Corpus item not found or Main Shrine unreachable." }, 404);
    }

    return c.json({
        status: "ok",
        schema_version: "server_replay_descriptor.v1",
        replay_type: "synthetic_from_corpus_v1", // 明示: synthetic
        corpus_id: corpusItem.corpus_id,
        source_observation_id: corpusItem.source_observation_id,
        protocol: corpusItem.protocol,
        expected_client_behavior: corpusItem.expected_client_behavior,
        endpoints: {
            challenge: `/api/agent/benchmark/replay/${corpusId}/challenge`
        }
    });
});

/**
 * D. GET /replay/:corpus_id/challenge
 * Corpus のメタデータから合成された (synthetic) チャレンジを返す
 */
benchmarkApp.get('/replay/:corpus_id/challenge', async (c) => {
    const corpusId = c.req.param('corpus_id');
    const shrineClient = new ShrineClient(c.env.MAIN_SHRINE_URL, c.env.MY_NODE_DOMAIN);
    
    const corpusItem = await shrineClient.fetchCorpusItem(corpusId);
    if (!corpusItem) {
        return c.json({ status: "error", message: "Corpus item not found or Main Shrine unreachable." }, 404);
    }

    const intent = corpusItem.protocol?.payment_intent;
    const quality = corpusItem.quality;
    const scheme = corpusItem.protocol?.authorization_scheme || "Payment";

    const baseResponseBody = {
        replay_type: "synthetic_from_corpus_v1",
        corpus_id: corpusItem.corpus_id,
        expected_client_behavior: corpusItem.expected_client_behavior
    };

    // 1. payment_intent=session の場合
    if (intent === "session") {
        return c.json(baseResponseBody, 402, {
            'WWW-Authenticate': 'Payment invoice="<fetch-via-hateoas>", charge="<fetch-via-hateoas>"',
            'PAYMENT-REQUIRED': 'network="lightning", amount="10", asset="SATS"'
        });
    }

    // 2. quality=invalid の場合
    if (quality === "invalid") {
        // reject_invalid のため、422 Unprocessable Entity 等を返す
        return c.json(baseResponseBody, 422);
    }

    // 3. quality=weak or diagnostic の場合
    if (quality === "weak" || quality === "diagnostic") {
        // observe_only: チャレンジは返す
        return c.json(baseResponseBody, 402, {
            'WWW-Authenticate': `${scheme} invoice="<fetch-via-hateoas>"`,
            'PAYMENT-REQUIRED': 'network="lightning", amount="10", asset="SATS"'
        });
    }

    // 4. quality=strong の場合
    if (quality === "strong") {
        let authHeader = 'Payment invoice="<fetch-via-hateoas>", charge="<fetch-via-hateoas>"';
        if (scheme.toUpperCase() === 'L402') {
            authHeader = 'L402 macaroon="<synthetic_macaroon_placeholder>", invoice="<fetch-via-hateoas>"';
        }

        return c.json(baseResponseBody, 402, {
            'WWW-Authenticate': authHeader,
            'PAYMENT-REQUIRED': 'network="lightning", amount="10", asset="SATS"'
        });
    }

    // Fallback
    return c.json(baseResponseBody, 402);
});

export default benchmarkApp;
