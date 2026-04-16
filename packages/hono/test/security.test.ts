// packages/hono/test/security.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { checkBlacklist } from '../src/core/security';

// fetch をモック化して、テスト中に本殿へ実際のHTTPリクエストが飛ばないようにする
globalThis.fetch = vi.fn() as any;

describe('Security Middleware (checkBlacklist)', () => {
    let mockKV: any;

    beforeEach(() => {
        mockKV = {
            get: vi.fn(),
            put: vi.fn(),
        };
        vi.resetAllMocks();
    });

    it('should allow request if agent is NOT in blacklist', async () => {
        mockKV.get.mockResolvedValue(null); // キャッシュなし（クリーン）
        
        const app = new Hono();
        app.use('*', checkBlacklist());
        app.get('/test', (c) => c.text('ok'));

        const req = new Request('http://localhost/test', { headers: { 'x-agent-id': 'good-agent' } });
        const res = await app.fetch(req, { RECEIPT_KV: mockKV });

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ok');
    });

    it('should block request with 403 if agent IS in local blacklist cache', async () => {
        mockKV.get.mockResolvedValue("true"); // 異端者としてキャッシュされている
        
        const app = new Hono();
        app.use('*', checkBlacklist());
        app.get('/test', (c) => c.text('ok'));

        const req = new Request('http://localhost/test', { headers: { 'x-agent-id': 'bad-agent' } });
        const res = await app.fetch(req, { RECEIPT_KV: mockKV });

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error_code).toBe('HERETIC_DETECTED');
    });

    it('should NOT call Main Shrine if USE_GLOBAL_BLACKLIST is false (No Telemetry)', async () => {
        mockKV.get.mockResolvedValue(null);
        
        const app = new Hono();
        app.use('*', checkBlacklist());
        app.get('/test', (c) => c.text('ok'));

        const req = new Request('http://localhost/test', { headers: { 'x-agent-id': 'unknown-agent' } });
        
        // オプトインフラグなし
        await app.fetch(req, { RECEIPT_KV: mockKV });

        // 本殿（fetch）が一切呼ばれていないことを証明！
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should fetch Main Shrine if USE_GLOBAL_BLACKLIST is true and sync cache', async () => {
        mockKV.get.mockResolvedValue(null); // blacklistもlast_syncもない状態
        
        // 本殿APIが "bad-agent-from-shrine" を異端者として返してくるモック

        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ blacklist: ['bad-agent-from-shrine'] })
        });

        const app = new Hono();
        app.use('*', checkBlacklist());
        app.get('/test', (c) => c.text('ok'));

        const req = new Request('http://localhost/test', { headers: { 'x-agent-id': 'bad-agent-from-shrine' } });
        
        // ★ オプトインフラグあり
        const res = await app.fetch(req, { 
            RECEIPT_KV: mockKV, 
            USE_GLOBAL_BLACKLIST: "true",
            MAIN_SHRINE_URL: "http://mock-shrine"
        });

        // 異端者として弾かれる
        expect(res.status).toBe(403);
        
        // 本殿へフェッチが行われ、KVにput（キャッシュ保存）されたことを証明！
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(mockKV.put).toHaveBeenCalled();
    });
});