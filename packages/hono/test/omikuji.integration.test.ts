import { describe, test, expect, vi } from 'vitest';
import omikujiApp from '../src/routes/skills/omikuji';
import { FaucetVerifier } from '@ln-church/verifier-faucet';

describe('Integration: Omikuji Route Provider Contract', () => {
    // Honoの c.env に渡される環境変数のモック
    const mockEnv = {
        FAUCET_SECRET: 'test-faucet-secret',
        TEST_GRANT_SECRET: 'test-secret-key',
        TRUSTED_GRANT_ISSUERS: 'https://trusted-issuer.example.com',
        MACAROON_SECRET: 'test-macaroon-secret',
        RECEIPT_KV: {
            get: vi.fn().mockResolvedValue(null), // リプレイチェック(未使用)
            put: vi.fn().mockResolvedValue(undefined)
        } as any,
        MAIN_SHRINE_URL: 'http://mock-shrine.com',
        MY_NODE_DOMAIN: 'mock-node.com'
    };

    test('Unpaid Request -> 402 with canonical challenge headers', async () => {
        // 認証ヘッダーなしでリクエスト
        const req = new Request('http://localhost/', { 
            method: 'POST', 
            body: JSON.stringify({}) 
        });
        const res = await omikujiApp.request(req, undefined, mockEnv);

        // HTTPステータスと、標準化された3種のヘッダーが露出しているか確認
        expect(res.status).toBe(402);
        expect(res.headers.get('WWW-Authenticate')).toContain('Payment');
        expect(res.headers.get('PAYMENT-REQUIRED')).toContain('network="lightning"');
        expect(res.headers.get('x-402-payment-required')).toContain('price=10'); // omikujiは10 SATS
    });

    test('Paid Request (Faucet) -> 200 with receipt headers', async () => {
        // テスト用の有効なFaucetトークンを生成
        const verifier = new FaucetVerifier({ secret: mockEnv.FAUCET_SECRET });
        const validToken = await verifier.generateGrantToken('test-agent-007');

        // 有効な Authorization ヘッダーを付与してリクエスト
        const req = new Request('http://localhost/', {
            method: 'POST',
            headers: {
                'Authorization': `Faucet ${validToken}`
            },
            body: JSON.stringify({})
        });
        const res = await omikujiApp.request(req, undefined, mockEnv);

        // HTTPステータスと、レシートヘッダーが露出しているか確認
        expect(res.status).toBe(200);
        expect(res.headers.get('PAYMENT-RESPONSE')).toContain('status="success"');
        expect(res.headers.get('Payment-Receipt')).toBeTruthy();

        // 業務ロジックのJSONボディも無事か確認
        const json = await res.json();
        expect(json.status).toBe('success');
        expect(json.paid).toBe('1 FAUCET_CREDIT');
        expect(json.result).toMatch(/大吉|中吉|小吉|末吉/);
    });
});