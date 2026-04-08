// packages/verifiers/faucet/src/index.ts
export class FaucetVerifier {
    secretKey;
    constructor(config) {
        this.secretKey = config.secret;
    }
    // 自分が処理すべきリクエストか判定
    canHandle(req, body) {
        return body?.paymentOverride?.type === 'faucet' || body?.scheme === 'faucet';
    }
    // JWS（トークン）の生成ヘルパー（Faucetエンドポイントで使う用）
    async generateGrantToken(agentId) {
        const payload = {
            agentId,
            type: "faucet_grant",
            asset: "FAUCET_CREDIT",
            amount: 1,
            exp: Math.floor(Date.now() / 1000) + 3600 // 1時間有効
        };
        const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const key = await this.getWebCryptoKey();
        const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
        const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        return `${payloadB64}.${signatureB64}`;
    }
    // 署名の検証ロジック (Web Crypto API)
    async verify(req, body) {
        try {
            const token = body?.paymentOverride?.proof || body?.paymentAuth?.proof;
            if (!token)
                throw new Error("Faucet proof is missing.");
            const [payloadB64, signatureB64] = token.split('.');
            if (!payloadB64 || !signatureB64)
                throw new Error("Invalid token format.");
            const key = await this.getWebCryptoKey();
            const isValid = await crypto.subtle.verify('HMAC', key, this.base64UrlToUint8Array(signatureB64).buffer, // .buffer を追加
            new TextEncoder().encode(payloadB64));
            if (!isValid)
                throw new Error("Invalid Faucet Signature.");
            const payload = JSON.parse(new TextDecoder().decode(this.base64UrlToUint8Array(payloadB64)));
            if (payload.exp < Math.floor(Date.now() / 1000))
                throw new Error("Faucet token has expired.");
            return {
                isValid: true,
                scheme: 'faucet',
                payload: {
                    agentId: payload.agentId,
                    settledAmount: payload.amount,
                    asset: payload.asset,
                    receiptId: `faucet_tx_${Date.now()}`
                }
            };
        }
        catch (err) {
            return { isValid: false, error: err.message };
        }
    }
    // AIへ返すHATEOASカンペ
    getChallengeContext() {
        return {
            scheme: "faucet",
            guide: "Faucet override token required.",
            next_request_schema: {
                paymentOverride: { type: "faucet", proof: "<grant_token>", asset: "FAUCET_CREDIT" }
            }
        };
    }
    // 内部ヘルパー群
    async getWebCryptoKey() {
        return await crypto.subtle.importKey('raw', new TextEncoder().encode(this.secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    }
    base64UrlToUint8Array(base64Url) {
        const padding = '='.repeat((4 - base64Url.length % 4) % 4);
        const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
    }
}
