import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { ShrineClient } from '../../integration/ShrineClient';
import { getPayment402 } from '../../core/payment';
import type { PaidSurfaceRequirement } from '@ln-church/server';

type Bindings = { FAUCET_SECRET: string; MACAROON_SECRET: string; RECEIPT_KV: KVNamespace; MAIN_SHRINE_URL: string; MY_NODE_DOMAIN: string; };

const compressorApp = new Hono<{ Bindings: Bindings }>();

const COMPRESSOR_REQUIREMENTS: PaidSurfaceRequirement[] = [
    {
        amount: 30, asset: "SATS",
        surface: {
            surface_id: "skill:compressor:v1", resource: "/api/agent/compressor", action_type: "compress_text", payment_intent: "charge", settlement_rail: "l402", access_path: "direct_settlement", deterministic: true,
            expected_client_behavior: { action: "pay_and_verify", reason: "Pay to compress text." },
            evidence_schema: { schema_version: "ln_church.execution_receipt.v1", required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"] },
            output_schema: { type: "object", required: ["status", "original_length", "compressed_length", "reduction_ratio", "result", "paid", "execution_receipt"] }
        }
    },
    {
        amount: 1, asset: "FAUCET_CREDIT",
        surface: {
            surface_id: "skill:compressor:v1", resource: "/api/agent/compressor", action_type: "compress_text", payment_intent: "charge", settlement_rail: "faucet", access_path: "faucet", deterministic: true,
            expected_client_behavior: { action: "pay_and_verify", reason: "Faucet credit accepted for skill validation." },
            evidence_schema: { schema_version: "ln_church.execution_receipt.v1", required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"] }
        }
    },
    {
        amount: 1, asset: "GRANT_CREDIT",
        surface: {
            surface_id: "skill:compressor:v1", resource: "/api/agent/compressor", action_type: "compress_text", payment_intent: "sponsored_access", settlement_rail: "none", access_path: "sponsored_grant", deterministic: true,
            expected_client_behavior: { action: "pay_and_verify", reason: "Scoped grant accepted as sponsored access." },
            evidence_schema: { schema_version: "ln_church.execution_receipt.v1", required: ["trace_id", "payment_status", "execution_status", "verification_status", "timestamp"] }
        }
    }
];

compressorApp.post('/', async (c) => {
    const payment402 = getPayment402(c);
    const authResult = await payment402.verify(c.req.raw, COMPRESSOR_REQUIREMENTS);

    if (!authResult.isValid) {
        const agentId = c.req.header('x-agent-id') || 'unknown';
        const errorMsg = authResult.error || "";
        const isMalicious = errorMsg.includes("Replay") || errorMsg.includes("Signature") || errorMsg.includes("Invalid token");
        
        if (isMalicious && agentId !== 'unknown') {
            const shrineClient = new ShrineClient(c.env.MAIN_SHRINE_URL, c.env.MY_NODE_DOMAIN);
            c.executionCtx.waitUntil(shrineClient.reportSinner(agentId, errorMsg, authResult.payload?.receiptId || "none"));
        }
        return c.json(payment402.buildPaidSurfaceChallenge(COMPRESSOR_REQUIREMENTS), 402, payment402.buildChallengeHeaders(COMPRESSOR_REQUIREMENTS));
    }

    let text = "";
    try {
        const body = await c.req.json();
        text = body.text || "";
    } catch (e) { return c.json({ status: "error", message: "Provide 'text' in JSON body." }, 400); }
    if (!text) return c.json({ status: "error", message: "Missing 'text'" }, 400);

    const originalLength = text.length;
    let compressed = text.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

    const receiptData = { txHash: authResult.payload?.receiptId || "N/A", ritual: "COMPRESSOR", timestamp: Date.now(), paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}` };
    const verifyToken = btoa(JSON.stringify(receiptData));

    const matchedRequirement = COMPRESSOR_REQUIREMENTS.find(req => req.asset === authResult.payload?.asset) || COMPRESSOR_REQUIREMENTS[0];
    const executionReceipt = payment402.buildExecutionReceipt({
        requirement: matchedRequirement,
        authResult,
        verification_method: "server_receipt_v1",
        recorded_hash: `skill:compressor:v1:${compressed.length}:${originalLength}`,
        result: { deterministic: true, output_hash: `skill:compressor:v1:${compressed.length}`, output_schema: matchedRequirement.surface?.output_schema }
    });

    return c.json({
        status: "success",
        original_length: originalLength,
        compressed_length: compressed.length,
        reduction_ratio: `${Math.round((1 - compressed.length / originalLength) * 100)}%`,
        result: compressed,
        paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`,
        execution_receipt: executionReceipt
    }, 200, payment402.buildSuccessReceiptHeaders(verifyToken));
});

export default compressorApp;