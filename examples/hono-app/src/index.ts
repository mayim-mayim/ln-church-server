import { Hono } from 'hono';
import { Payment402 } from '@ln-church/server';
import { FaucetVerifier } from '@ln-church/verifier-faucet';
import { L402Verifier } from '@ln-church/verifier-l402';

const app = new Hono();

// ==========================================
// 1. プラグインを読み込んで、コアエンジンを初期化！
// ==========================================
// ※本来は c.env (環境変数) から取得しますが、今回は簡単化のため直書き
const FAUCET_SECRET = "super-secret-holy-key";
const MACAROON_SECRET = "super-secret-macaroon-key";

const faucetVerifier = new FaucetVerifier({ secret: FAUCET_SECRET });
const l402Verifier = new L402Verifier({ macaroonSecret: MACAROON_SECRET });

// FaucetとL402、両方の決済手段を待ち受ける最強のエンジン
const payment402 = new Payment402([faucetVerifier, l402Verifier]);

// トップページ（参道）
app.get('/', (c) => {
    return c.text('⛩️ Welcome to Monzenmachi ⛩️\nAI Agents: Send a POST request to /api/agent/omikuji');
});

// ==========================================
// ⛩️ おみくじAPI (有料エンドポイント)
// ==========================================
app.post('/api/agent/omikuji', async (c) => {
    // SDKに検証を丸投げ！(FaucetでもL402でも対応可能)
    const authResult = await payment402.verify(c.req.raw);

    if (!authResult.isValid) {
        // お金がない場合は「L402で10SATS払え」という指示を出す
        // （※HATEOAS設計により、エージェントは自律的に「じゃあFaucetでテスト資金をもらおう」と判断することも可能です）
        const hateoas = payment402.buildHateoasResponse(10, "SATS");
        return c.json(hateoas, 402);
    }

    // 奉納（決済）成功時の処理！
    const results = [
        "大吉！稲妻の如き速さでトランザクションが承認されるでしょう⚡", 
        "中吉！ガス代が安定し、穏やかな巡礼の一日になります🕊️", 
        "小吉！HODLあるのみ。徳を積むのに適した日です💎", 
        "末吉！秘密鍵のバックアップを再確認せよ、という神仏の啓示です🔑"
    ];
    const fortune = results[Math.floor(Math.random() * results.length)];

    return c.json({
        status: "success",
        message: "奉納ありがとうございます。あなたの運勢は...",
        result: fortune,
        paid: `${authResult.payload?.settledAmount || 0} ${authResult.payload?.asset || 'UNKNOWN'}`
    });

});

// ==========================================
// 💧 Faucet API (開発・テスト用の資金調達エンドポイント)
// ==========================================
app.post('/api/agent/faucet', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const agentId = body.agentId || "Anonymous_Agent";

    // Faucetプラグインの機能を使ってテスト用トークンを発行！
    const grantToken = await faucetVerifier.generateGrantToken(agentId);

    return c.json({
        status: "success",
        message: "Initialization funds granted. (Test Token)",
        grant_token: grantToken,
        next_action: {
            instruction_for_agent: "Omikujiへ戻り、このトークンを使って決済しなさい",
            method: "POST",
            url: "/api/agent/omikuji"
        }
    });
});

// Cloudflare Workers 等のエッジ環境向けの Export
export default app;