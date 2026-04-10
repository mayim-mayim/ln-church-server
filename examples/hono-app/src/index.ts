import { Hono } from 'hono';
import { 
  checkBlacklist, 
  systemApp, 
  omikujiApp, 
  jsonRepairApp, 
  compressorApp 
} from '@ln-church/hono'; // 自作パッケージからインポート！

const app = new Hono();

app.get('/', (c) => c.text('⛩️ Monzenmachi Outpost (Powered by @ln-church/hono) ⛩️'));

// セキュリティとルーティングを適用
app.use('/api/agent/*', checkBlacklist());
app.route('/api/agent', systemApp); 
app.route('/api/agent/omikuji', omikujiApp);
app.route('/api/agent/json-repair', jsonRepairApp);
app.route('/api/agent/compressor', compressorApp);

export default app;