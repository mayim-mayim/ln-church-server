import { describe, test, expect } from 'vitest';
import benchmarkApp from '../src/routes/benchmark';
import { FaucetVerifier } from '@ln-church/verifier-faucet';

describe('Benchmark Suite Integration', () => {
    const mockEnv = {
        FAUCET_SECRET: 'test-faucet-secret',
        MACAROON_SECRET: 'test-macaroon-secret',
        RECEIPT_KV: {
            get: async () => null,
            put: async () => undefined
        } as any,
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
});