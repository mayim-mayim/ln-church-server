import { describe, test, expect, vi } from 'vitest';
import jsonRepairApp from '../../packages/hono/src/routes/skills/json-repair';

// 任意の金額(amount)を持つFaucetトークンを生成するヘルパー
async function createCustomFaucetToken(secret: string, amount: number) {
    const payload = { agentId: "agent-x", type: "faucet_grant", asset: "FAUCET_CREDIT", amount, exp: Math.floor(Date.now() / 1000) + 3600 };
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${payloadB64}.${signatureB64}`;
}

describe('Integration: JSON Repair Paid Surface', () => {
    const mockEnv = { 
        FAUCET_SECRET: 'test-secret', 
        TEST_GRANT_SECRET: 'test-secret-key',
        TRUSTED_GRANT_ISSUERS: 'https://trusted-issuer.example.com',
        MACAROON_SECRET: 'test-macaroon-secret',
        RECEIPT_KV: { get: vi.fn(), put: vi.fn() } as any, 
        MAIN_SHRINE_URL: 'http://mock', 
        MY_NODE_DOMAIN: 'mock.com' 
    };

    test('POST /api/agent/json-repair without payment -> 402 with Paid Surface Challenge', async () => {
        const req = new Request('http://localhost/', { method: 'POST', body: JSON.stringify({ raw_text: "{ bad: json }" }) });
        const res = await jsonRepairApp.request(req, undefined, mockEnv);
        expect(res.status).toBe(402);
        const json = await res.json();
        expect(json.schema_version).toBe("ln_church.paid_surface_challenge.v1");
        expect(json.surface.surface_id).toBe("skill:json-repair:v1");
        expect(json.surface.action_type).toBe("json_repair");
        expect(json.surface.deterministic).toBe(true);
    });

    test('POST /api/agent/json-repair with Faucet token -> 200 with Execution Receipt', async () => {
        // json-repairが要求する「2」FAUCET_CREDITのトークンを生成
        const token = await createCustomFaucetToken(mockEnv.FAUCET_SECRET, 2);
        
        const req = new Request('http://localhost/', { method: 'POST', headers: { 'Authorization': `Faucet ${token}` }, body: JSON.stringify({ raw_text: "{ \"name\": \"agent\" }" }) });
        const res = await jsonRepairApp.request(req, undefined, mockEnv);
        
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.status).toBe("success");
        expect(json.execution_receipt).toBeDefined();
        expect(json.execution_receipt.surface_id).toBe("skill:json-repair:v1");
        expect(json.execution_receipt.payment_status).toBe("succeeded");
        expect(json.execution_receipt.result.deterministic).toBe(true);
    });
});