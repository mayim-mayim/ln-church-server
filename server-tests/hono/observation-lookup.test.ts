import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import systemApp from '../../packages/hono/src/routes/system';
import { ShrineClient } from '../../packages/hono/src/integration/ShrineClient';

describe('Seller-Side Observation Lookup (Paid Surface Diagnostics)', () => {
    let originalFetch: typeof globalThis.fetch;

    const mockEnv = {
        FAUCET_SECRET: 'test-faucet-secret',
        MACAROON_SECRET: 'test-macaroon-secret',
        RECEIPT_KV: { get: async () => null, put: async () => undefined } as any,
        MAIN_SHRINE_URL: 'http://mock-shrine.com',
        MY_NODE_DOMAIN: 'example.com'
    };

    beforeAll(() => {
        originalFetch = globalThis.fetch;
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    test('ShrineClient throws if neither domain nor url is provided', async () => {
        const client = new ShrineClient('http://mock', 'mock.com');
        await expect(client.fetchFailureObservations({})).rejects.toThrow("Either targetDomain or targetUrl must be provided.");
    });

    test('ShrineClient builds correct URL and fetches successfully', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: "success",
                targetDomain: "example.com",
                count: 1,
                items: [{ failure_class: "retry_mismatch", not_a_verdict: true }]
            })
        });

        const client = new ShrineClient('http://mock', 'mock.com');
        const result = await client.fetchFailureObservations({ targetDomain: "example.com", limit: 10 });
        
        expect(globalThis.fetch).toHaveBeenCalledWith('http://mock/api/agent/external/failure-observations?targetDomain=example.com&limit=10');
        expect(result?.count).toBe(1);
        expect(result?.items[0].not_a_verdict).toBe(true);
    });

    test('ShrineClient handles upstream 500 safely by returning null', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
        
        const client = new ShrineClient('http://mock', 'mock.com');
        const result = await client.fetchFailureObservations({ targetDomain: "example.com" });
        
        expect(result).toBeNull();
    });

    test('Hono route GET /observations returns 400 if params are missing', async () => {
        const res = await systemApp.request(new Request('http://localhost/observations'), undefined, mockEnv);
        expect(res.status).toBe(400);
    });

    test('Hono route GET /observations returns diagnostic response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                status: "success",
                targetDomain: "example.com",
                count: 2,
                failure_classes: { "retry_mismatch": 2 },
                items: [{ evidence_strength: "medium" }]
            })
        });

        const res = await systemApp.request(new Request('http://localhost/observations?domain=example.com'), undefined, mockEnv);
        const json = await res.json();
        
        expect(res.status).toBe(200);
        expect(json.diagnostic_type).toBe("seller_side_observation_lookup");
        expect(json.not_a_verdict).toBe(true);
        expect(json.summary.count).toBe(2);
        expect(json.summary.top_failure_class).toBe("retry_mismatch");
        expect(json.disclaimer).toContain("not verdicts about endpoint correctness");
    });

    test('Hono route GET /observations returns safe empty diagnostic on upstream failure', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

        const res = await systemApp.request(new Request('http://localhost/observations?url=https://example.com/api'), undefined, mockEnv);
        const json = await res.json();
        
        expect(res.status).toBe(200); // サーバーエラーではなく、空の診断結果を返す
        expect(json.summary.count).toBe(0);
        expect(json.items).toHaveLength(0);
        expect(json.disclaimer).toContain("Failed to communicate");
    });
});