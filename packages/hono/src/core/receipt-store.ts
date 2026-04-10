// src/core/receipt-store.ts
import type { KVNamespace } from '@cloudflare/workers-types';
import { ReceiptStore } from '@ln-church/server';

export class CloudflareKVReceiptStore implements ReceiptStore {
    constructor(private kv: KVNamespace) {}

    async checkAndStore(receiptId: string): Promise<boolean> {
        const key = `receipt:${receiptId}`;
        const exists = await this.kv.get(key);
        if (exists) return false; 
        
        // 24時間 (86400秒) で自動消去して容量節約
        await this.kv.put(key, "used", { expirationTtl: 86400 }); 
        return true;
    }
}