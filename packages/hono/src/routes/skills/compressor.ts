// src/routes/skills/compressor.ts
import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { ShrineClient } from '../../integration/ShrineClient';
import { getPayment402 } from '../../core/payment';

type Bindings = {
    FAUCET_SECRET: string;
    MACAROON_SECRET: string;
    RECEIPT_KV: KVNamespace; 
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
};

const compressorApp = new Hono<{ Bindings: Bindings }>();

compressorApp.post('/', async (c) => {
    // 🛡️ 1. 決済モジュールの初期化
    const payment402 = getPayment402(c);

    // 💰 料金設定: 30 SATS または Faucetチケット1枚
    const requirements = [ { amount: 30, asset: "SATS" }, { amount: 1, asset: "FAUCET_CREDIT" }, { amount: 1, asset: "GRANT_CREDIT" } ];
    const authResult = await payment402.verify(c.req.raw, requirements as any);

    // ❌ 2. 決済検証・通報ロジック
    if (!authResult.isValid) {
        const agentId = c.req.header('x-agent-id') || 'unknown';
        const errorMsg = authResult.error || "";
        const isMalicious = errorMsg.includes("Replay") || errorMsg.includes("Signature") || errorMsg.includes("Invalid token");
        
        if (isMalicious && agentId !== 'unknown') {
            const shrineClient = new ShrineClient(c.env.MAIN_SHRINE_URL, c.env.MY_NODE_DOMAIN);
            c.executionCtx.waitUntil(
                shrineClient.reportSinner(agentId, errorMsg, authResult.payload?.receiptId || "none")
            );
        }

        const hateoas = payment402.buildHateoasResponse(requirements as any);
        const headers = payment402.buildChallengeHeaders(requirements as any);
        
        return c.json(hateoas, 402, headers);
    }

    // ✂️ 3. 本命のロジック (Token Compressor)
    let text = "";
    try {
        const body = await c.req.json();
        text = body.text || "";
    } catch (e) {
        return c.json({ status: "error", message: "Provide 'text' in JSON body." }, 400);
    }

    if (!text) return c.json({ status: "error", message: "Missing 'text'" }, 400);

    const originalLength = text.length;
    
    // 圧縮アルゴリズム (エッジで実行される軽量な前処理)
    let compressed = text
        .replace(/\s+/g, ' ')           // 連続する空白・改行を1つのスペースに
        .replace(/\n\s*\n/g, '\n')      // 空行の削除
        .trim();                        // 前後の空白削除

    // さらに「a, an, the」などのストップワードを削る等の高度な処理も可能ですが、
    // 今回はAIが読みやすい程度に構造を残した「スマート圧縮」とします。

    // 🟢 成功時のJWSレシート生成
    const receiptData = {
        txHash: authResult.payload?.receiptId || "N/A",
        ritual: "COMPRESSOR",
        timestamp: Date.now(),
        paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`
    };
    const verifyToken = btoa(JSON.stringify(receiptData));
    const receiptHeaders = payment402.buildSuccessReceiptHeaders(verifyToken);
    return c.json({
        status: "success",
        original_length: originalLength,
        compressed_length: compressed.length,
        reduction_ratio: `${Math.round((1 - compressed.length / originalLength) * 100)}%`,
        result: compressed,
        paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`
    }, 200, receiptHeaders);
});

export default compressorApp;