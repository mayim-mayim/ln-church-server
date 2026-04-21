// src/routes/skills/json-repair.ts
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

const jsonRepairApp = new Hono<{ Bindings: Bindings }>();

jsonRepairApp.post('/', async (c) => {
    // 🛡️ 1. 決済モジュールの初期化
    const payment402 = getPayment402(c); // ★ 初期化をシンプルに

    // 💰 料金設定: 実用スキルなので少し高め
    const requirements = [ { amount: 50, asset: "SATS" }, { amount: 2, asset: "FAUCET_CREDIT" }, { amount: 2, asset: "GRANT_CREDIT" } ];
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

    // 🩹 3. 本命のロジック (JSON修復外科医)
    let rawText = "";
    try {
        const body = await c.req.json();
        rawText = body.raw_text || "";
    } catch (e) {
        return c.json({ status: "error", message: "Invalid request. Provide 'raw_text' in JSON body." }, 400);
    }

    if (!rawText) {
         return c.json({ status: "error", message: "Missing 'raw_text'" }, 400);
    }

    let repairedJson = null;
    let isRepaired = false;

    // 修復アルゴリズム (エッジで爆速実行)
    try {
        // まずはそのままパースできるかテスト
        repairedJson = JSON.parse(rawText);
    } catch (initialError) {
        isRepaired = true;
        let fixedText = rawText;

        // 処置1: Markdownのコードブロックを剥がす
        // (システムのコードブロック誤検知を避けるため RegExp + 文字数指定 `{3}` を使用)
        const codeBlockRegex = new RegExp('`{3}(?:json)?\\s*([\\s\\S]*?)\\s*`{3}');
        const codeBlockMatch = fixedText.match(codeBlockRegex);
        if (codeBlockMatch) fixedText = codeBlockMatch[1];

        // 処置2: 末尾の余計なカンマを削除 (例: "key": "value", } -> "key": "value" })
        fixedText = fixedText.replace(/,\s*([\]}])/g, '$1');

        try {
            repairedJson = JSON.parse(fixedText);
        } catch (secondError) {
            // 処置の限界を超えている場合
            return c.json({
                status: "failed",
                message: "JSON is too mangled to repair algorithmically.",
                paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`
            }, 422);
        }
    }

    // 🟢 成功時のJWSレシート生成
    const receiptData = {
        txHash: authResult.payload?.receiptId || "N/A",
        ritual: "JSON_REPAIR",
        timestamp: Date.now(),
        paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`
    };
    const verifyToken = btoa(JSON.stringify(receiptData));
    const receiptHeaders = payment402.buildSuccessReceiptHeaders(verifyToken);

    // 成功レスポンス
    return c.json({
        status: "success",
        message: isRepaired ? "JSON was successfully repaired." : "JSON was already valid.",
        result: repairedJson,
        paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`
    }, 200, receiptHeaders);
});

export default jsonRepairApp;