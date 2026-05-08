import { describe, test, expect } from 'vitest';
import systemApp from '../../packages/hono/src/routes/system';
import { MONZEN_CONFIG } from '../../packages/hono/src/core/config';

describe('System Routes Integration (Benchmark-First)', () => {
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
        
        expect(json.next_action.instruction_for_agent).toContain('validate your 402 runtime');
        expect(json.next_action.capabilities[0].name).toBe('benchmark_ping');
    });

    // ★ テスト名も「現在のバージョン」と動的な表現に変更
    test('Manifest exposes benchmark_provider role and current version', async () => {
        const res = await systemApp.request(new Request('http://localhost/manifest'), undefined, mockEnv);
        const json = await res.json();
        
        // ★ ハードコードをやめ、MONZEN_CONFIG.VERSION と一致するかテストする
        expect(json.version).toBe(MONZEN_CONFIG.VERSION);
        expect(json.node_role).toBe("benchmark_provider");
        expect(json.public_evaluability).toBe(true);
        expect(json.benchmark_suite.endpoints[0].scenario).toBe("ping-v1");
        expect(json.benchmark_suite.endpoints[0].deterministic).toBe(true);
    });
});