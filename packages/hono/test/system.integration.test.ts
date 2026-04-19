import { describe, test, expect } from 'vitest';
import systemApp from '../src/routes/system';

describe('System Routes Integration (Benchmark-First)', () => {
    // 略さずに全て記述します
    const mockEnv = {
        FAUCET_SECRET: 'test-faucet-secret',
        MACAROON_SECRET: 'test-macaroon-secret',
        RECEIPT_KV: {
            get: async () => null,
            put: async () => undefined
        } as any,
        MAIN_SHRINE_URL: 'http://mock-shrine.com',
        MY_NODE_DOMAIN: 'mock-node.com'
    };

    test('Faucet onboarding prioritizes benchmark endpoint', async () => {
        const res = await systemApp.request(new Request('http://localhost/faucet', { method: 'POST' }), undefined, mockEnv);
        const json = await res.json();
        
        // Next action が ping を最優先で案内しているか
        expect(json.next_action.instruction_for_agent).toContain('validate your 402 runtime');
        expect(json.next_action.capabilities[0].name).toBe('benchmark_ping');
    });

    test('Manifest exposes benchmark_provider role and version 1.4.0', async () => {
        const res = await systemApp.request(new Request('http://localhost/manifest'), undefined, mockEnv);
        const json = await res.json();
        
        expect(json.version).toBe("1.4.0");
        expect(json.node_role).toBe("benchmark_provider");
        expect(json.public_evaluability).toBe(true);
        expect(json.benchmark_suite.endpoints[0].scenario).toBe("ping-v1");
        expect(json.benchmark_suite.endpoints[0].deterministic).toBe(true);
    });
});