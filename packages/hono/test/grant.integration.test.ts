/// <reference types="node" />
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { describe, test, expect, vi } from 'vitest';
import omikujiApp from '../src/routes/skills/omikuji';
import { FaucetVerifier } from '@ln-church/verifier-faucet';

// 補助1: HMAC JWS生成ヘルパー
async function createMockGrant(claims: any, secret: string) {
    const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, '');
    const payloadB64 = btoa(JSON.stringify(claims)).replace(/=/g, '');
    // WebCryptoを使用
    const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerB64}.${payloadB64}`));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${headerB64}.${payloadB64}.${sigB64}`;
}

// 補助2: Ed25519 JWS生成ヘルパー (Node.js crypto を使用)
async function createEd25519MockGrant(claims: any) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    
    const header = { alg: "EdDSA", typ: "JWT", kid: "test-ed25519-key" };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
    
    const signature = crypto.sign(null, Buffer.from(`${headerB64}.${payloadB64}`), privateKey);
    const sigB64 = signature.toString('base64url');
    
    const rawPubKey = publicKey.export({ format: 'der', type: 'spki' }).slice(12);
    
    return { 
        token: `${headerB64}.${payloadB64}.${sigB64}`,
        jwk: {
            kty: "OKP",
            crv: "Ed25519",
            use: "sig",
            kid: "test-ed25519-key",
            x: rawPubKey.toString('base64url')
        }
    };
}

describe('Grant Verifier Integration (Omikuji)', () => {
    const mockEnv = {
        FAUCET_SECRET: 'test-secret-key',
        TEST_GRANT_SECRET: 'test-secret-key',
        TRUSTED_GRANT_ISSUERS: 'https://trusted-issuer.example.com',
        MACAROON_SECRET: 'test-macaroon-secret',
        RECEIPT_KV: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined) } as any,
        MY_NODE_DOMAIN: 'mock-node.com'
    };

    const validClaims = {
        iss: "https://trusted-issuer.example.com",
        sub: "agent-007",
        aud: "https://mock-node.com",
        jti: "unique-grant-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        grant_type: "api_access",
        asset: "GRANT_CREDIT",
        amount: 1,
        scope: { routes: ["/"], methods: ["POST"] }
    };

    // 1. unpaid -> 402
    test('Unpaid request returns 402', async () => {
        const req = new Request('https://mock-node.com/', { method: 'POST' });
        const res = await omikujiApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(402);
    });

    // 2. valid grant -> 200 (agentId を追加)
    test('Valid grant in paymentOverride returns 200', async () => {
        const proof = await createMockGrant(validClaims, mockEnv.FAUCET_SECRET);
        const req = new Request('https://mock-node.com/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: "agent-007", paymentOverride: { type: "grant", proof, asset: "GRANT_CREDIT" } })
        });
        const res = await omikujiApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(200);
    });

    // 3. invalid signature -> 403 (agentId を追加)
    test('Invalid signature returns 403', async () => {
        const proof = await createMockGrant(validClaims, "wrong-secret-key");
        const req = new Request('https://mock-node.com/', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: "agent-007", paymentOverride: { type: "grant", proof } }) 
        });
        const res = await omikujiApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(403);
    });

    // 4. expired grant -> 403 (agentId を追加)
    test('Expired grant returns 403', async () => {
        const proof = await createMockGrant({ ...validClaims, exp: Math.floor(Date.now() / 1000) - 100 }, mockEnv.FAUCET_SECRET);
        const req = new Request('https://mock-node.com/', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: "agent-007", paymentOverride: { type: "grant", proof } }) 
        });
        const res = await omikujiApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(403);
    });

    // 5. wrong audience -> 403 (agentId を追加)
    test('Wrong audience returns 403', async () => {
        const proof = await createMockGrant({ ...validClaims, aud: "https://wrong-audience.com" }, mockEnv.FAUCET_SECRET);
        const req = new Request('https://mock-node.com/', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: "agent-007", paymentOverride: { type: "grant", proof } }) 
        });
        const res = await omikujiApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(403);
    });

    // 6. wrong route scope -> 403 (agentId を追加)
    test('Wrong route scope returns 403', async () => {
        const proof = await createMockGrant({ ...validClaims, scope: { routes: ["/api/other"], methods: ["POST"] } }, mockEnv.FAUCET_SECRET);
        const req = new Request('https://mock-node.com/', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: "agent-007", paymentOverride: { type: "grant", proof } }) 
        });
        const res = await omikujiApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(403);
    });

    // 7. replayed jti -> 403 (agentId を追加)
    test('Replayed token returns 403', async () => {
        const proof = await createMockGrant(validClaims, mockEnv.FAUCET_SECRET);
        const replayEnv = { ...mockEnv, RECEIPT_KV: { get: vi.fn().mockResolvedValue("used"), put: vi.fn() } as any };
        const req = new Request('https://mock-node.com/', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: "agent-007", paymentOverride: { type: "grant", proof } }) 
        });
        const res = await omikujiApp.request(req, undefined, replayEnv);
        expect(res.status).toBe(403);
    });

    // 8. legacy faucet remains green
    test('Legacy Faucet header still works', async () => {
        const verifier = new FaucetVerifier({ secret: mockEnv.FAUCET_SECRET });
        const token = await verifier.generateGrantToken('agent-007');
        const req = new Request('https://mock-node.com/', {
            method: 'POST', 
            headers: { 'Authorization': `Faucet ${token}` }
        });
        const res = await omikujiApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(200);
    });

    // 9. Ed25519 real e2e flow (JWKS + kid resolution)
    test('Ed25519 real e2e flow (JWKS + kid resolution)', async () => {
        const { token, jwk } = await createEd25519MockGrant({
            ...validClaims,
            iss: "https://ed25519-issuer.example.com"
        });

        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn(async (url) => {
            if (url === "https://ed25519-issuer.example.com/.well-known/jwks.json") {
                return { ok: true, json: async () => ({ keys: [jwk] }) } as any;
            }
            return originalFetch(url);
        });

        const testEnv = {
            ...mockEnv,
            TRUSTED_GRANT_ISSUERS: "https://trusted-issuer.example.com,https://ed25519-issuer.example.com"
        };

        const req = new Request('https://mock-node.com/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-agent-id': 'agent-007' },
            body: JSON.stringify({ paymentOverride: { type: "grant", proof: token, asset: "GRANT_CREDIT" } })
        });

        const res = await omikujiApp.request(req, undefined, testEnv);
        expect(res.status).toBe(200);

        globalThis.fetch = originalFetch; 
    });
});