import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { getPayment402 } from '../core/payment';
import { ShrineClient } from '../integration/ShrineClient';

type Bindings = {
    FAUCET_SECRET: string;
    MACAROON_SECRET: string;
    RECEIPT_KV: KVNamespace;
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
};

const benchmarkApp = new Hono<{ Bindings: Bindings }>();

// 共通設定: ベンチマークは一律 10 SATS / 1 FAUCET_CREDIT / 1 GRANT_CREDIT
const BENCH_REQUIREMENTS = [
    { amount: 10, asset: "SATS" }, 
    { amount: 1, asset: "FAUCET_CREDIT" }, 
    { amount: 1, asset: "GRANT_CREDIT" }
];

/**
 * A. GET /ping
 * 最小の決定論的 Paid GET
 */
benchmarkApp.get('/ping', async (c) => {
    const p402 = getPayment402(c);
    const auth = await p402.verify(c.req.raw, BENCH_REQUIREMENTS);

    if (!auth.isValid) {
        return c.json(p402.buildHateoasResponse(BENCH_REQUIREMENTS), 402, p402.buildChallengeHeaders(BENCH_REQUIREMENTS));
    }

    const receiptToken = btoa(JSON.stringify({ scenario: "ping-v1", ts: Date.now() }));
    return c.json({
        status: "success",
        kind: "benchmark_result",
        scenario: "ping-v1",
        result: "ok",
        deterministic: true
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
