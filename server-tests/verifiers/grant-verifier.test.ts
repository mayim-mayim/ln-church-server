import { describe, it, expect } from 'vitest';
import { GrantVerifier } from '../../packages/verifiers/grant/src/index';

// テスト用のダミーJWSトークンを生成するヘルパー関数
function createMockToken(claims: any) {
    const header = btoa(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: "test" }));
    const payload = btoa(JSON.stringify(claims));
    const signature = "dummy_signature";
    return `${header}.${payload}.${signature}`;
}

describe('GrantVerifier Strict Validation', () => {
    const mockOptions = {
        audience: 'https://kari.mayim-mayim.com',
        trustedIssuers: ['https://kari.mayim-mayim.com'],
        issuerKeyResolver: async () => ({} as CryptoKey) // 署名検証までは行かないのでダミー
    };

    const baseClaims = {
        iss: 'https://kari.mayim-mayim.com',
        sub: 'agent123',
        aud: 'https://kari.mayim-mayim.com',
        jti: 'grant_001',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1時間後
        asset: 'GRANT_CREDIT',
        amount: 1,
        scope: { routes: ['/api/agent/omikuji'], methods: ['POST'] }
    };

    it('JTI(トークン識別子)が欠損している場合はエラーになること', async () => {
        const verifier = new GrantVerifier(mockOptions);
        const claims = { ...baseClaims };
        delete (claims as any).jti; // jtiを消す

        const req = { headers: new Map([['Authorization', `Grant ${createMockToken(claims)}`]]) };
        const result = await verifier.verify(req);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("missing jti");
    });

    it('アセットがGRANT_CREDIT以外の場合は決済レール扱いとみなしエラーになること', async () => {
        const verifier = new GrantVerifier(mockOptions);
        const claims = { ...baseClaims, asset: "USDC" }; // 不正なアセット

        const req = { headers: new Map([['Authorization', `Grant ${createMockToken(claims)}`]]) };
        const result = await verifier.verify(req);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("must be GRANT_CREDIT");
    });

    it('Scope(ルートやメソッドの権限指定)がない場合はエラーになること', async () => {
        const verifier = new GrantVerifier(mockOptions);
        const claims = { ...baseClaims };
        delete (claims as any).scope;

        const req = { headers: new Map([['Authorization', `Grant ${createMockToken(claims)}`]]) };
        const result = await verifier.verify(req);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("route scope missing");
    });

    // EXPの欠損チェック
    it('EXPが欠損している場合はエラーになること', async () => {
        const verifier = new GrantVerifier(mockOptions);
        const claims = { ...baseClaims };
        delete (claims as any).exp;

        const req = { headers: new Map([['Authorization', `Grant ${createMockToken(claims)}`]]) };
        const result = await verifier.verify(req);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain("missing exp");
    });
});