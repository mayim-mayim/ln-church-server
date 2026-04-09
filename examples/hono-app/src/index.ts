import { Hono } from 'hono';
import { Payment402 } from '@ln-church/server';
import { FaucetVerifier } from '@ln-church/verifier-faucet';
import { L402Verifier } from '@ln-church/verifier-l402';

// ==========================================
// 🛡️ 1. 環境変数の「型」を厳格に定義する
// ==========================================
type Bindings = {
    FAUCET_SECRET: string;
    MACAROON_SECRET: string;
};

// Honoに環境変数の型を教え込む（これで c.env.xxx で安全に補完が効きます）
const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => {
    return c.text('⛩️ Welcome to Monzenmachi ⛩️\nAI Agents: Send a POST request to /api/agent/omikuji');
});


// ==========================================
// ⛩️ おみくじAPI (有料エンドポイント)
// ==========================================
app.post('/api/agent/omikuji', async (c) => {
    // 🛡️ 2. リクエストごとに、安全な環境変数(c.env)を使ってエンジンを初期化
    const faucetVerifier = new FaucetVerifier({ secret: c.env.FAUCET_SECRET });
    const l402Verifier = new L402Verifier({ macaroonSecret: c.env.MACAROON_SECRET });
    const payment402 = new Payment402([faucetVerifier, l402Verifier]);

    const authResult = await payment402.verify(c.req.raw);

    if (!authResult.isValid) {
        const hateoas = payment402.buildHateoasResponse(10, "SATS");
        
        // ※本来はここで生成したMacaroonとInvoiceを渡しますが、今回はエージェント向けの
        // HATEOAS設計（自律取得）を優先しているため、プロトコル宣言として付与します。
        c.header('WWW-Authenticate', 'L402 macaroon="<fetch-via-hateoas>", invoice="<fetch-via-hateoas>"');
        
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
    // 🛡️ Faucet単体の呼び出し時も、同様に c.env から安全に初期化
    const faucetVerifier = new FaucetVerifier({ secret: c.env.FAUCET_SECRET });

    const body = await c.req.json().catch(() => ({}));
    const agentId = body.agentId || "Anonymous_Agent";

    const grantToken = await faucetVerifier.generateGrantToken(agentId);

    return c.json({
        status: "success",
        message: "Initialization funds granted. (Test Token)",
        grant_token: grantToken,
        next_action: {
            instruction_for_agent: "Omikujiへ戻り、このトークンを使いなさい",
            method: "POST",
            url: "/api/agent/omikuji"
        }
    });
});


// Cloudflare Workers 等のエッジ環境向けの Export
export default app;