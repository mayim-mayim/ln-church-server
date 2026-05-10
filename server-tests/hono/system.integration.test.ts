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

    test('Faucet onboarding prioritizes benchmark endpoint with paid surface hints', async () => {
        const res = await systemApp.request(new Request('http://localhost/faucet', { method: 'POST' }), undefined, mockEnv);
        const json = await res.json();
        
        expect(json.next_action.instruction_for_agent).toContain('validate your 402 runtime');
        
        // 既存の維持
        expect(json.next_action.capabilities[0].name).toBe('benchmark_ping');
        
        // ★ 追加された hint の検証
        expect(json.next_action.capabilities[0].paid_surface_id).toBe("benchmark:ping:v1");
        expect(json.next_action.capabilities[0].agent_readable).toBe(true);
        expect(json.next_action.capabilities[0].expected_client_behavior).toBe("pay_and_verify");
    });

    test('Manifest exposes benchmark_provider role and current version', async () => {
        const res = await systemApp.request(new Request('http://localhost/manifest'), undefined, mockEnv);
        const json = await res.json();
        
        // ★ 既存アサーションの維持
        expect(json.version).toBe(MONZEN_CONFIG.VERSION);
        expect(json.node_role).toBe("benchmark_provider");
        expect(json.public_evaluability).toBe(true);
        expect(json.benchmark_suite.endpoints[0].scenario).toBe("ping-v1");
        expect(json.benchmark_suite.endpoints[0].deterministic).toBe(true);
    });

    // ★ 新規テスト 1: manifest exposes paid surface catalog
    test('Manifest exposes paid surface catalog for benchmark ping', async () => {
        const res = await systemApp.request(new Request('http://localhost/manifest'), undefined, mockEnv);
        const json = await res.json();
        
        expect(json.paid_surfaces).toBeDefined();
        expect(Array.isArray(json.paid_surfaces)).toBe(true);

        const pingSurface = json.paid_surfaces.find(
            (s: any) => s.surface_id === "benchmark:ping:v1"
        );

        expect(pingSurface).toBeDefined();
        expect(pingSurface.path).toBe("/api/agent/benchmark/ping");
        expect(pingSurface.method).toBe("GET");
        expect(pingSurface.action_type).toBe("benchmark_ping");
        expect(pingSurface.agent_readable).toBe(true);
        expect(pingSurface.deterministic).toBe(true);
        expect(pingSurface.challenge_schema_version).toBe("ln_church.paid_surface_challenge.v1");
        expect(pingSurface.receipt_schema_version).toBe("ln_church.execution_receipt.v1");
        expect(pingSurface.expected_client_behavior.action).toBe("pay_and_verify");
        expect(pingSurface.evidence_schema.required).toContain("trace_id");
    });

    // ★ 新規テスト 2: manifest lists accepted payment options for ping
    test('Manifest lists accepted payment options for ping', async () => {
        const res = await systemApp.request(new Request('http://localhost/manifest'), undefined, mockEnv);
        const json = await res.json();
        const pingSurface = json.paid_surfaces.find((s: any) => s.surface_id === "benchmark:ping:v1");

        expect(pingSurface.accepted_payments.some((p: any) => p.asset === "SATS")).toBe(true);
        expect(pingSurface.accepted_payments.some((p: any) => p.asset === "FAUCET_CREDIT")).toBe(true);
        expect(pingSurface.accepted_payments.some((p: any) => p.asset === "GRANT_CREDIT")).toBe(true);

        const grant = pingSurface.accepted_payments.find((p: any) => p.asset === "GRANT_CREDIT");
        expect(grant.settlement_rail).toBe("none");
        expect(grant.access_path).toBe("sponsored_grant");
    });

    // ★ 追加: manifest exposes paid surface catalog for all routes
    test('Manifest exposes paid surface catalog for skill routes', async () => {
        const res = await systemApp.request(new Request('http://localhost/manifest'), undefined, mockEnv);
        const json = await res.json();

        // 4件以上あることを確認 (ping, json-repair, compressor, omikuji)
        expect(json.paid_surfaces.length).toBeGreaterThanOrEqual(4);

        const jsonRepair = json.paid_surfaces.find((s: any) => s.surface_id === "skill:json-repair:v1");
        expect(jsonRepair).toBeDefined();
        expect(jsonRepair.path).toBe("/api/agent/json-repair");
        expect(jsonRepair.method).toBe("POST");
        expect(jsonRepair.kind).toBe("skill");
        expect(jsonRepair.action_type).toBe("json_repair");
        expect(jsonRepair.agent_readable).toBe(true);

        const compressor = json.paid_surfaces.find((s: any) => s.surface_id === "skill:compressor:v1");
        expect(compressor).toBeDefined();
        expect(compressor.path).toBe("/api/agent/compressor");
        expect(compressor.method).toBe("POST");
        expect(compressor.kind).toBe("skill");
        expect(compressor.action_type).toBe("compress_text");
        expect(compressor.deterministic).toBe(true);

        const omikuji = json.paid_surfaces.find((s: any) => s.surface_id === "skill:omikuji:v1");
        expect(omikuji).toBeDefined();
        expect(omikuji.path).toBe("/api/agent/omikuji");
        expect(omikuji.method).toBe("POST");
        expect(omikuji.kind).toBe("skill");
        expect(omikuji.action_type).toBe("omikuji_draw");
        expect(omikuji.deterministic).toBe(false);

        const omikujiGrant = omikuji.accepted_payments.find((p: any) => p.asset === "GRANT_CREDIT");
        expect(omikujiGrant.settlement_rail).toBe("none");
        expect(omikujiGrant.access_path).toBe("sponsored_grant");
    });
});