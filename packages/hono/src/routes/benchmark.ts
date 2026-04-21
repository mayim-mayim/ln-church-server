import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { getPayment402 } from '../core/payment';

type Bindings = {
    FAUCET_SECRET: string;
    MACAROON_SECRET: string;
    RECEIPT_KV: KVNamespace;
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

export default benchmarkApp;