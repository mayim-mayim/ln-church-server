import { describe, test, expect, vi } from 'vitest';
import compressorApp from '../../packages/hono/src/routes/skills/compressor';
import { FaucetVerifier } from '@ln-church/verifier-faucet';

describe('Integration: Compressor Paid Surface', () => {
    const mockEnv = { 
        FAUCET_SECRET: 'test-secret', 
        TEST_GRANT_SECRET: 'test-secret-key',
        TRUSTED_GRANT_ISSUERS: 'https://trusted-issuer.example.com',
        MACAROON_SECRET: 'test-macaroon-secret',
        RECEIPT_KV: { get: vi.fn(), put: vi.fn() } as any, 
        MAIN_SHRINE_URL: 'http://mock', 
        MY_NODE_DOMAIN: 'mock.com' 
    };

    test('POST /api/agent/compressor without payment -> 402 with Paid Surface Challenge', async () => {
        const req = new Request('http://localhost/', { method: 'POST', body: JSON.stringify({ text: "test" }) });
        const res = await compressorApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(402);
        const json = await res.json();
        expect(json.schema_version).toBe("ln_church.paid_surface_challenge.v1");
        expect(json.surface.surface_id).toBe("skill:compressor:v1");
        expect(json.surface.action_type).toBe("compress_text");
        expect(json.surface.deterministic).toBe(true);
    });

    test('POST /api/agent/compressor with Faucet token -> 200 with Execution Receipt', async () => {
        const verifier = new FaucetVerifier({ secret: mockEnv.FAUCET_SECRET });
        const token = await verifier.generateGrantToken('agent-y');
        const req = new Request('http://localhost/', { method: 'POST', headers: { 'Authorization': `Faucet ${token}` }, body: JSON.stringify({ text: "Hello    World" }) });
        const res = await compressorApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.result).toBe("Hello World");
        expect(json.execution_receipt).toBeDefined();
        expect(json.execution_receipt.surface_id).toBe("skill:compressor:v1");
        expect(json.execution_receipt.payment_status).toBe("succeeded");
        expect(json.execution_receipt.result.deterministic).toBe(true);
    });
});