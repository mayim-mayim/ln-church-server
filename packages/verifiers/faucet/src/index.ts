// packages/verifiers/faucet/src/index.ts

import type { PaymentVerifier, VerifyResult } from '@ln-church/server';

export class FaucetVerifier implements PaymentVerifier {
    // ★ 修正1: scheme プロパティを明示的に定義！
    public readonly scheme = 'faucet';
    
    private secretKey: string;

    constructor(config: { secret: string }) {
        this.secretKey = config.secret;
    }

    // ==========================================
    // 🛡️ 新機能：HTTPヘッダーからFaucetトークンを抽出する
    // ==========================================
    private extractToken(req: any): string | null {
        if (!req || !req.headers) return null;
        
        const authHeader = typeof req.headers.get === 'function' 
            ? req.headers.get('Authorization') 
            : req.headers['authorization'] || req.headers['Authorization'];

        if (!authHeader) return null;

        // "Faucet <grant_token>" の形式を分解
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toUpperCase() === 'FAUCET') {
            return parts[1];
        }
        return null;
    }

    // JWS（トークン）の生成ヘルパー（Faucetエンドポイントで使う用）
    async generateGrantToken(agentId: string): Promise<string> {
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

    // 1. 引数を req: any だけに修正！
    public canHandle(req: any): boolean {
        return this.extractToken(req) !== null;
    }

    // 2. 指示書もJSONボディではなくヘッダーを使うように修正！
    // ★ 修正2: 古い getChallengeContext を削除し、これだけに統一！
    public getChallengeContext(): Record<string, any> {
        return {
            scheme: this.scheme,
            guide: "Faucet token required. Fetch a grant_token from /api/agent/faucet and set the Authorization header.",
            next_request_instruction: {
                headers: {
                    Authorization: "Faucet <grant_token>"
                }
            }
        };
    }

    // 3. 引数を req: any だけに修正し、決済成功時の金額をセット！
    public async verify(req: any): Promise<VerifyResult> {
        const token = this.extractToken(req);

        if (!token) {
            return { isValid: false, error: "Missing Faucet token in Authorization header." };
        }

        try {
            // 🌟 封印されしHMAC検証ロジックを完全復活！
            const [payloadB64, signatureB64] = token.split('.');
            if (!payloadB64 || !signatureB64) throw new Error("Invalid token format.");

            const key = await this.getWebCryptoKey();

            const signatureUint8 = this.base64UrlToUint8Array(signatureB64);
            
            const isValid = await crypto.subtle.verify(
                'HMAC', 
                key, 
                signatureUint8 as any,
                new TextEncoder().encode(payloadB64)
            );

            if (!isValid) throw new Error("Invalid Faucet Signature.");

            const payload = JSON.parse(new TextDecoder().decode(this.base64UrlToUint8Array(payloadB64)));
            if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Faucet token has expired.");

            return { 
                isValid: true, 
                scheme: this.scheme,
                payload: {
                    agentId: payload.agentId, 
                    settledAmount: payload.amount, // 1
                    asset: payload.asset,          // FAUCET_CREDIT
                    receiptId: `faucet-${Date.now()}`
                }
            };

        } catch (e: any) {
            return { isValid: false, error: `Faucet Verification failed: ${e.message}` };
        }
    }

    // 内部ヘルパー群
    private async getWebCryptoKey() {
        return await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(this.secretKey),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign', 'verify']
        );
    }

    private base64UrlToUint8Array(base64Url: string): Uint8Array {
        const padding = '='.repeat((4 - base64Url.length % 4) % 4);
        const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
    }
}