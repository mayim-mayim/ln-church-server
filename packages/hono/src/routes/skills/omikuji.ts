// src/routes/skills/omikuji.ts
import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { Payment402 } from '@ln-church/server'; 
import { FaucetVerifier } from '@ln-church/verifier-faucet';
import { L402Verifier } from '@ln-church/verifier-l402';
import { CloudflareKVReceiptStore } from '../../core/receipt-store';
import { ShrineClient } from '../../integration/ShrineClient';

type Bindings = {
    FAUCET_SECRET: string;
    MACAROON_SECRET: string;
    RECEIPT_KV: KVNamespace; 
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
};

const omikujiApp = new Hono<{ Bindings: Bindings }>();

omikujiApp.post('/', async (c) => {
    const faucetVerifier = new FaucetVerifier({ secret: c.env.FAUCET_SECRET });
    const l402Verifier = new L402Verifier({ macaroonSecret: c.env.MACAROON_SECRET });
    const kvStore = new CloudflareKVReceiptStore(c.env.RECEIPT_KV);
    const payment402 = new Payment402([faucetVerifier, l402Verifier], { receiptStore: kvStore });

    const requirements = [ { amount: 10, asset: "SATS" }, { amount: 1, asset: "FAUCET_CREDIT" } ];
    const authResult = await payment402.verify(c.req.raw, requirements as any);

    if (!authResult.isValid) {
        // 🚨 異端審問官への通報ロジック
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