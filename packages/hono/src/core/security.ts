// src/core/security.ts
import { MiddlewareHandler } from 'hono';
import { KVNamespace } from '@cloudflare/workers-types';

type Bindings = {
    RECEIPT_KV: KVNamespace;
};

export const checkBlacklist = (): MiddlewareHandler<{ Bindings: Bindings }> => {
    return async (c, next) => {
        const agentId = c.req.header('x-agent-id') || 'unknown'; 
        
        if (agentId !== 'unknown') {
            const isBlacklisted = await c.env.RECEIPT_KV.get(`blacklist:${agentId}`);
            if (isBlacklisted) {
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