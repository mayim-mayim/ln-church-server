// src/index.ts
import { Hono } from 'hono';
import type { KVNamespace } from '@cloudflare/workers-types';
import { checkBlacklist } from './core/security';

// モジュールのインポート
import systemApp from './routes/system';
import omikujiApp from './routes/skills/omikuji';
import jsonRepairApp from './routes/skills/json-repair';
import compressorApp from './routes/skills/compressor';

type Bindings = {
    RECEIPT_KV: KVNamespace; 
    MAIN_SHRINE_URL: string;
    MY_NODE_DOMAIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 生存確認
app.get('/', (c) => c.text('⛩️ Welcome to Monzenmachi Outpost ⛩️'));

// セキュリティ層の適用
app.use('/api/agent/*', checkBlacklist());

// ルーティング
app.route('/api/agent', systemApp); 
app.route('/api/agent/omikuji', omikujiApp);
app.route('/api/agent/json-repair', jsonRepairApp);
app.route('/api/agent/compressor', compressorApp);

// ★ Cron (scheduled) を完全に削除し、標準のHonoエクスポートのみに！
export default app;