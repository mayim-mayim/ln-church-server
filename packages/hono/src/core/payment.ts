// packages/hono/src/core/payment.ts
import { Payment402 } from '@ln-church/server';
import { FaucetVerifier } from '@ln-church/verifier-faucet';
import { L402Verifier } from '@ln-church/verifier-l402';
import { GrantVerifier } from '@ln-church/verifier-grant';
import { CloudflareKVReceiptStore } from './receipt-store';

const jwksCache = new Map<string, CryptoKey>();

export const getPayment402 = (c: any) => {
    const faucet = new FaucetVerifier({ secret: c.env.FAUCET_SECRET });
    const l402 = new L402Verifier({ macaroonSecret: c.env.MACAROON_SECRET });
    
    // 環境変数からカンマ区切りで読み込み（デフォルトは本殿）
    const trustedIssuers = (c.env.TRUSTED_GRANT_ISSUERS || "https://kari.mayim-mayim.com")
        .split(',').map((i: string) => i.trim()).filter(Boolean);

    const grant = new GrantVerifier({
        audience: `https://${c.env.MY_NODE_DOMAIN}`,
        trustedIssuers: trustedIssuers,
        issuerKeyResolver: async (iss: string, kid?: string) => {
            if (c.env.TEST_GRANT_SECRET && iss === "https://trusted-issuer.example.com") {
                return crypto.subtle.importKey('raw', new TextEncoder().encode(c.env.TEST_GRANT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
            }

            const cacheKey = kid ? `${iss}#${kid}` : iss;
            if (jwksCache.has(cacheKey)) return jwksCache.get(cacheKey)!;

            try {
                const res = await fetch(`${iss}/.well-known/jwks.json`);
                if (!res.ok) return null;
                const jwks = await res.json();
                
                let keyDef = null;
                if (kid) {
                    keyDef = jwks.keys?.find((k: any) => k.kid === kid);
                }
                if (!keyDef) {
                    keyDef = jwks.keys?.[0]; 
                }
                if (!keyDef) return null;

                let alg: any;
                if (keyDef.kty === 'OKP' && keyDef.crv === 'Ed25519') {
                    alg = { name: 'Ed25519' };
                } else if (keyDef.alg === 'ES256') {
                    alg = { name: 'ECDSA', namedCurve: 'P-256' };
                } else {
                    alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
                }
                
                const key = await crypto.subtle.importKey('jwk', keyDef, alg, false, ['verify']);
                jwksCache.set(cacheKey, key);
                return key;
            } catch (e) {
                console.error("[GrantVerifier] JWKS fetch failed for", iss);
                return null;
            }
        }
    });

    const kvStore = new CloudflareKVReceiptStore(c.env.RECEIPT_KV);
    return new Payment402([grant, faucet, l402], { receiptStore: kvStore });
};