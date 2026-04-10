// src/index.ts
import { Hono } from 'hono';
import type { KVNamespace, ExecutionContext } from '@cloudflare/workers-types';
import { checkBlacklist } from './core/security';
import { ShrineClient } from './integration/ShrineClient';

// モジュールのインポート
import systemApp from './routes/system';
import omikujiApp from './routes/skills/omikuji';
import jsonRepairApp from './routes/skills/json-repair'; // ★追加: JSON修復
import compressorApp from './routes/skills/compressor';

type Bindings = {
    RECEIPT_KV: KVNamespace; 
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
};

// ここで 'app' が誕生します。これより上で 'app' は使えません。
const app = new Hono<{ Bindings: Bindings }>();

// 1. 生存確認
app.get('/', (c) => c.text('⛩️ Welcome to Monzenmachi Outpost ⛩️'));

// 2. 閻魔帳ミドルウェア（/api/agent/ 配下すべてに結界を張る）
app.use('/api/agent/*', checkBlacklist());

// 3. ルーティング（各モジュールへの振り分け）
// /api/agent/faucet と /api/agent/manifest がマウントされます
app.route('/api/agent', systemApp); 

// /api/agent/omikuji がマウントされます
app.route('/api/agent/omikuji', omikujiApp);

// /api/agent/json-repair がマウントされます
app.route('/api/agent/json-repair', jsonRepairApp); 

// /api/agent/compressor がマウントされます
app.route('/api/agent/compressor', compressorApp);

// ==========================================
// ⏳ Cron Triggers (定期的な同期と報告)
// ==========================================
export default {
    fetch: app.fetch,
    scheduled: async (event: any, env: Bindings, ctx: ExecutionContext) => {
        const shrineClient = new ShrineClient(env.MAIN_SHRINE_URL, env.MY_NODE_DOMAIN);

        ctx.waitUntil((async () => {
            // 1. ノードの生存と機能の報告
            await shrineClient.registerNode([
                "/api/agent/omikuji",
                "/api/agent/json-repair",
                "/api/agent/compressor",
                "/api/agent/faucet"
            ]);

            // 2. 最新の閻魔帳を同期してKVへ一括キャッシュ
            const blacklist = await shrineClient.fetchBlacklist();
            for (const sinnerId of blacklist) {
                await env.RECEIPT_KV.put(`blacklist:${sinnerId}`, "true", { expirationTtl: 86400 });
            }
            console.log(`[Cron] Synced ${blacklist.length} sinners to local KV.`);
        })());
    }
};