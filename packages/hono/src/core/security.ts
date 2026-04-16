// src/core/security.ts
import { MiddlewareHandler } from 'hono';
import { KVNamespace } from '@cloudflare/workers-types';
import { ShrineClient } from '../integration/ShrineClient';

type Bindings = {
    RECEIPT_KV: KVNamespace;
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
    USE_GLOBAL_BLACKLIST?: string; 
};

export const checkBlacklist = (): MiddlewareHandler<{ Bindings: Bindings }> => {
    return async (c, next) => {
        // 1. エージェントIDの抽出 (ヘッダー優先、なければJSONボディから抽出)
        let agentId = c.req.header('x-agent-id');
        if (!agentId && c.req.method === 'POST') {
            try {
                const clonedReq = c.req.raw.clone();
                const body = await clonedReq.json();
                agentId = body.agentId;
            } catch (e) {}
        }
        agentId = agentId || 'unknown';

        if (agentId !== 'unknown') {
            const cacheKey = `blacklist:${agentId}`;
            
            // 2. ローカルKVキャッシュ（手動登録分含む）を確認
            let isBlacklisted = await c.env.RECEIPT_KV.get(cacheKey);

            // 3. オプトイン設定が "true" の場合のみ、本殿の閻魔帳へ自律的に同期 (Phone-home防止)
            if (isBlacklisted === null && c.env.USE_GLOBAL_BLACKLIST === "true") {
                const lastSync = await c.env.RECEIPT_KV.get('blacklist_last_sync');
                
                if (!lastSync) {
                    console.log(`[Security] Opt-in enabled: Syncing Heretic List from Main Shrine...`);
                    const shrineClient = new ShrineClient(c.env.MAIN_SHRINE_URL, c.env.MY_NODE_DOMAIN);
                    const heretics = await shrineClient.fetchBlacklist();

                    // 取得した異端者リストをKVに1時間 (3600秒) キャッシュ
                    for (const heretic of heretics) {
                        await c.env.RECEIPT_KV.put(`blacklist:${heretic}`, "true", { expirationTtl: 3600 });
                    }
                    // 同期時刻を記録 (1時間有効)
                    await c.env.RECEIPT_KV.put('blacklist_last_sync', Date.now().toString(), { expirationTtl: 3600 });

                    isBlacklisted = heretics.includes(agentId) ? "true" : null;
                }
            }

            // 4. 異端者なら 403 で遮断
            if (isBlacklisted === "true") {
                return c.json({
                    status: "error",
                    error_code: "HERETIC_DETECTED",
                    message: "You have been excommunicated from the network due to past transgressions."
                }, 403);
            }
        }
        
        await next();
    };
};