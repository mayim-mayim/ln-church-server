import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import benchmarkApp from '../src/routes/benchmark';
import { FaucetVerifier } from '@ln-church/verifier-faucet';

const mockEnv = {
    FAUCET_SECRET: 'test-faucet-secret',
    TEST_GRANT_SECRET: 'test-secret-key',
    TRUSTED_GRANT_ISSUERS: 'https://trusted-issuer.example.com', 
    MACAROON_SECRET: 'test-macaroon-secret',
    RECEIPT_KV: {
        get: async () => null,
        put: async () => undefined
    } as any,
    MAIN_SHRINE_URL: 'http://mock-shrine.com',
    MY_NODE_DOMAIN: 'mock-node.com'
};

// JWS生成ヘルパー
async function createMockGrant(claims: any, secret: string) {
    const headerB64 = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, '');
    const payloadB64 = btoa(JSON.stringify(claims)).replace(/=/g, '');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerB64}.${payloadB64}`));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${headerB64}.${payloadB64}.${sigB64}`;
}

describe('Benchmark Suite Integration', () => {
    const mockEnv = {
        FAUCET_SECRET: 'test-faucet-secret',
        TEST_GRANT_SECRET: 'test-secret-key',
        TRUSTED_GRANT_ISSUERS: 'https://trusted-issuer.example.com', 
        MACAROON_SECRET: 'test-macaroon-secret',
        RECEIPT_KV: {
            get: async () => null,
            put: async () => undefined
        } as any,
        MY_NODE_DOMAIN: 'mock-node.com'
    };

    // Grant用の共通クレーム定義
    const validGrantClaims = {
        iss: "https://trusted-issuer.example.com",
        sub: "benchmark-grant-agent",
        aud: "https://mock-node.com",
        jti: "unique-bench-grant-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        grant_type: "api_access",
        asset: "GRANT_CREDIT",
        amount: 1,
        scope: { routes: ["/ping", "/echo"], methods: ["GET", "POST"] }
    };

    // 象限1: Unpaid Ping
    test('GET /ping unpaid -> returns 402 challenge', async () => {
        const res = await benchmarkApp.request(new Request('http://localhost/ping'), undefined, mockEnv);
        expect(res.status).toBe(402);
        expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
    });

    // 象限2: Paid Ping (新規追加)
    test('GET /ping paid -> returns deterministic response', async () => {
        const verifier = new FaucetVerifier({ secret: mockEnv.FAUCET_SECRET });
        const validToken = await verifier.generateGrantToken('benchmark-agent');

        const req = new Request('http://localhost/ping', {
            headers: { 'Authorization': `Faucet ${validToken}` }
        });
        
        const res = await benchmarkApp.request(req, undefined, mockEnv);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json.scenario).toBe("ping-v1");
        expect(json.result).toBe("ok");
        expect(json.deterministic).toBe(true);
    });

    // 象限3: Unpaid Echo (新規追加)
    test('POST /echo unpaid -> returns 402 challenge', async () => {
        const req = new Request('http://localhost/echo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "benchmark-test" })
        });
        const res = await benchmarkApp.request(req, undefined, mockEnv);
        
        expect(res.status).toBe(402);
        expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
    });

    // 象限4: Paid Echo
    test('POST /echo paid -> returns deterministic body', async () => {
        const verifier = new FaucetVerifier({ secret: mockEnv.FAUCET_SECRET });
        const validToken = await verifier.generateGrantToken('benchmark-agent');

        const req = new Request('http://localhost/echo', {
            method: 'POST',
            headers: { 'Authorization': `Faucet ${validToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: "benchmark-test" })
        });
        
        const res = await benchmarkApp.request(req, undefined, mockEnv);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json.result.text).toBe("benchmark-test");
        expect(json.deterministic).toBe(true);
    });

    // 象限5: Paid Ping (Grant)
    test('GET /ping paid via Grant -> returns deterministic response', async () => {
        const proof = await createMockGrant(validGrantClaims, mockEnv.TEST_GRANT_SECRET);
        const req = new Request('http://localhost/ping', {
            headers: { 
                'Authorization': `Grant ${proof}`,
                'x-agent-id': 'benchmark-grant-agent' // sub と一致させる
            }
        });
        const res = await benchmarkApp.request(req, undefined, mockEnv);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json.scenario).toBe("ping-v1");
        expect(json.deterministic).toBe(true);
    });

    // 象限6: Paid Echo (Grant / paymentOverride)
    test('POST /echo paid via Grant override -> returns deterministic body', async () => {
        const proof = await createMockGrant(validGrantClaims, mockEnv.TEST_GRANT_SECRET);
        const req = new Request('http://localhost/echo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: "benchmark-grant-test",
                agentId: "benchmark-grant-agent", // sub と一致させる
                paymentOverride: { type: "grant", proof, asset: "GRANT_CREDIT" }
            })
        });
        const res = await benchmarkApp.request(req, undefined, mockEnv);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json.result.text).toBe("benchmark-grant-test");
    });
});

describe('Corpus Replay Endpoints (Synthetic)', () => {

    let originalFetch: typeof globalThis.fetch;

    beforeAll(() => {
        originalFetch = globalThis.fetch;
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    test('GET /replay/:corpus_id returns descriptor safely if Shrine returns 500', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
        const res = await benchmarkApp.request(new Request('http://localhost/replay/corp_missing'), undefined, mockEnv);
        expect(res.status).toBe(404);
    });

    test('GET /replay/:corpus_id returns valid descriptor', async () => {
        const mockCorpus = {
            corpus_id: "corp_123",
            protocol: { payment_intent: "charge" },
            expected_client_behavior: { action: "pay_and_verify" }
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true, json: async () => ({ item: mockCorpus })
        });

        const res = await benchmarkApp.request(new Request('http://localhost/replay/corp_123'), undefined, mockEnv);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json.replay_type).toBe("synthetic_from_corpus_v1");
        expect(json.expected_client_behavior.action).toBe("pay_and_verify");
    });

    test('GET /replay/:corpus_id/challenge returns strong pay_and_verify (402 challenge)', async () => {
        const mockCorpus = {
            corpus_id: "corp_strong",
            quality: "strong",
            protocol: { authorization_scheme: "L402", payment_intent: "charge" },
            expected_client_behavior: { action: "pay_and_verify" }
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true, json: async () => ({ item: mockCorpus })
        });

        const res = await benchmarkApp.request(new Request('http://localhost/replay/corp_strong/challenge'), undefined, mockEnv);
        const json = await res.json();

        expect(res.status).toBe(402);
        expect(res.headers.get('WWW-Authenticate')).toContain('L402 macaroon');
        expect(json.expected_client_behavior.action).toBe("pay_and_verify");
    });

    test('GET /replay/:corpus_id/challenge returns stop_safely for session intent', async () => {
        const mockCorpus = {
            corpus_id: "corp_session",
            quality: "strong", // quality より intent が優先される
            protocol: { payment_intent: "session" },
            expected_client_behavior: { action: "stop_safely" }
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true, json: async () => ({ item: mockCorpus })
        });

        const res = await benchmarkApp.request(new Request('http://localhost/replay/corp_session/challenge'), undefined, mockEnv);
        const json = await res.json();

        expect(res.status).toBe(402);
        expect(json.expected_client_behavior.action).toBe("stop_safely");
    });

    test('GET /replay/:corpus_id/challenge returns reject_invalid for invalid corpus (422)', async () => {
        const mockCorpus = {
            corpus_id: "corp_invalid",
            quality: "invalid",
            expected_client_behavior: { action: "reject_invalid" }
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true, json: async () => ({ item: mockCorpus })
        });

        const res = await benchmarkApp.request(new Request('http://localhost/replay/corp_invalid/challenge'), undefined, mockEnv);
        const json = await res.json();

        expect(res.status).toBe(422);
        expect(json.expected_client_behavior.action).toBe("reject_invalid");
    });
});