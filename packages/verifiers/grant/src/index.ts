import type { PaymentVerifier, VerifyResult } from '@ln-church/server';

export interface GrantClaims {
    iss: string;
    sub: string;
    aud: string;
    jti: string;
    nbf?: number;
    iat: number;
    exp: number;
    grant_type: string;
    asset: string;
    amount: number;
    scope: {
        routes: string[];
        methods: string[];
    };
}

export interface GrantVerifierOptions {
    audience: string;
    trustedIssuers: string[];
    issuerKeyResolver: (iss: string, kid?: string) => Promise<CryptoKey | null>;
}

export class GrantVerifier implements PaymentVerifier {
    public readonly scheme = 'grant';

    constructor(private options: GrantVerifierOptions) {}

    private async extractProof(req: any): Promise<string | null> {
        if (!req) return null;
        
        // 1. Header (Authorization: Grant <token>)
        const authHeader = typeof req.headers?.get === 'function' 
            ? req.headers.get('Authorization') 
            : req.headers?.['authorization'] || req.headers?.['Authorization'];

        if (authHeader) {
            const parts = authHeader.split(' ');
            if (parts.length === 2 && parts[0].toLowerCase() === 'grant') return parts[1];
        }

        // 2. Body (paymentOverride)
        if (typeof req.clone === 'function' && req.method !== 'GET' && req.method !== 'HEAD') {
            try {
                const cloned = req.clone();
                const body = await cloned.json();
                if (body?.paymentOverride?.type === 'grant') return body.paymentOverride.proof;
            } catch (e) {}
        }
        return null;
    }

    public async canHandle(req: any): Promise<boolean> {
        return (await this.extractProof(req)) !== null;
    }

    public getChallengeContext(): Record<string, any> {
        return {
            scheme: this.scheme,
            guide: "Provide a valid Grant JWS token in paymentOverride. Note: Grant is a pre-payment access verifier, not a settlement rail.",
            next_request_schema: {
                paymentOverride: { type: "grant", proof: "<JWS_GRANT_TOKEN>", asset: "GRANT_CREDIT" }
            }
        };
    }

    public async verify(req: any): Promise<VerifyResult> {
        const token = await this.extractProof(req);
        if (!token) return { isValid: false, error: "Missing grant proof." };

        try {
            const parts = token.split('.');
            if (parts.length !== 3) throw new Error("Invalid JWS format.");
            const [headerB64, payloadB64, signatureB64] = parts;

            const header = JSON.parse(new TextDecoder().decode(this.base64UrlToUint8Array(headerB64)));
            const claims: GrantClaims = JSON.parse(new TextDecoder().decode(this.base64UrlToUint8Array(payloadB64)));

            // Strict Validation
            if (!claims.jti) throw new Error("Grant token missing jti.");
            if (!claims.asset || claims.asset !== "GRANT_CREDIT") throw new Error("Grant asset must be GRANT_CREDIT.");
            if (!claims.scope?.routes?.length) throw new Error("Grant route scope missing.");
            if (!claims.scope?.methods?.length) throw new Error("Grant method scope missing.");
            if (claims.nbf && claims.nbf > Math.floor(Date.now() / 1000)) throw new Error("Grant token not yet valid.");

            // Time Validation (expの欠損チェックを追加)
            if (!claims.exp) throw new Error("Grant token missing exp.");
            if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error("Grant token expired.");

            // Agent Binding Validation
            let requestAgentId = typeof req.headers?.get === 'function' ? req.headers.get('x-agent-id') : null;
            if (!requestAgentId && typeof req.clone === 'function' && req.method !== 'GET' && req.method !== 'HEAD') {
                try {
                    const cloned = req.clone();
                    const body = await cloned.json();
                    requestAgentId = body?.agentId;
                } catch (e) {}
            }
            
            if (!requestAgentId) {
                throw new Error("Agent ID is required in header (x-agent-id) or body for grant authorization.");
            }
            if (requestAgentId !== claims.sub) {
                throw new Error("Agent binding mismatch.");
            }

            // Trust Validation
            if (!this.options.trustedIssuers.includes(claims.iss)) throw new Error("Untrusted issuer.");
            if (claims.aud !== this.options.audience) throw new Error("Audience mismatch.");

            // Scope Validation
            const urlStr = typeof req.url === 'string' ? req.url : (req.url?.toString() || "");
            const url = new URL(urlStr, this.options.audience);
            if (!claims.scope.routes.includes(url.pathname)) throw new Error("Route not in scope.");
            
            const method = typeof req.method === 'string' ? req.method.toUpperCase() : "GET";
            if (!claims.scope.methods.includes(method)) throw new Error("Method not in scope.");

            // Signature Validation
            const key = await this.options.issuerKeyResolver(claims.iss, header.kid);
            if (!key) throw new Error("Issuer key not found.");

            const isValidSignature = await crypto.subtle.verify(
                key.algorithm,
                key,
                this.base64UrlToUint8Array(signatureB64) as any,
                new TextEncoder().encode(`${headerB64}.${payloadB64}`)
            );

            if (!isValidSignature) throw new Error("Invalid grant signature.");

            return {
                isValid: true,
                scheme: this.scheme,
                payload: {
                    agentId: claims.sub,
                    settledAmount: claims.amount,
                    asset: claims.asset,
                    receiptId: `grant:${claims.jti}`,
                    issuer: claims.iss,
                    grantId: claims.jti,
                    grantType: claims.grant_type,
                    scope: claims.scope,
                    accessPath: "sponsored_grant",
                    authorizationArtifact: "scoped_grant",
                    settlementRail: "none"
                }
            };

        } catch (e: any) {
            return { isValid: false, error: `Grant Verification failed: ${e.message}` };
        }
    }

    private base64UrlToUint8Array(base64Url: string): Uint8Array {
        const padding = '='.repeat((4 - base64Url.length % 4) % 4);
        const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
    }
}