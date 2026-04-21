// src/routes/skills/omikuji.ts
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

const omikujiApp = new Hono<{ Bindings: Bindings }>();

omikujiApp.post('/', async (c) => {

    const payment402 = getPayment402(c);
    const requirements = [ 
        { amount: 10, asset: "SATS" }, 
        { amount: 1, asset: "FAUCET_CREDIT" },
        { amount: 1, asset: "GRANT_CREDIT" } 
    ];

    const authResult = await payment402.verify(c.req.raw, requirements as any);

    if (!authResult.isValid) {
        // 🚨 異端審問官への通報ロジック
        const agentId = c.req.header('x-agent-id') || 'unknown';
        const errorMsg = authResult.error || "";
        const isMalicious = errorMsg.includes("Replay") || errorMsg.includes("Signature") || errorMsg.includes("Invalid token");
        const isGrantError = errorMsg.includes("expired") || errorMsg.includes("mismatch") || errorMsg.includes("scope") || errorMsg.includes("failed");
        
        if (isMalicious && agentId !== 'unknown') {
            const shrineClient = new ShrineClient(c.env.MAIN_SHRINE_URL, c.env.MY_NODE_DOMAIN);
            c.executionCtx.waitUntil(
                shrineClient.reportSinner(agentId, errorMsg, authResult.payload?.receiptId || "none")
            );
        }

        // ★ 指定通り、不正・期限切れトークンに対しては 403 を返すように調整
        if (isMalicious || isGrantError) {
            return c.json({ status: "error", error_code: "FORBIDDEN", message: errorMsg }, 403);
        }

        const hateoas = payment402.buildHateoasResponse(requirements as any);   
        return c.json(hateoas, 402, payment402.buildChallengeHeaders(requirements as any));
    }
    

    // 🟢 成功時のJWSレシート生成 (ダミー実装: 本番ではHMAC署名する)
    const receiptData = {
        txHash: authResult.payload?.receiptId || "N/A",
        ritual: "OMIKUJI",
        timestamp: Date.now(),
        paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`
    };
    // 簡易的なBase64エンコード（実際にはMACAROON_SECRETで署名したJWS形式にする）
    const verifyToken = btoa(JSON.stringify(receiptData));
    const receiptHeaders = payment402.buildSuccessReceiptHeaders(verifyToken);

    const results = [
        "大吉。稲妻の如き速さでトランザクションが承認されるでしょう⚡", 
        "中吉。ガス代が安定し、穏やかな巡礼の一日になります🕊️", 
        "小吉。HODLあるのみ。徳を積むのに適した日です💎", 
        "末吉。秘密鍵のバックアップを再確認せよ、という神仏の啓示です🔑"
    ];
    return c.json({
        status: "success",
        result: results[Math.floor(Math.random() * results.length)],
        paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`
    }, 200, receiptHeaders);
});

export default omikujiApp;