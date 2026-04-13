import { PaymentVerifier, VerifyResult } from '@ln-church/server';
import crypto from 'node:crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MacaroonsBuilder, MacaroonsVerifier } = require('macaroons.js');

export interface L402Config {
    macaroonSecret?: string;
    nodeUrl?: string;
}

export class L402Verifier implements PaymentVerifier {
    public readonly scheme = 'L402';

    constructor(private config: L402Config = {}) {}

    // ==========================================
    // 🛡️ L402 & MPP デュアルスタック証明抽出
    // ==========================================
    private extractProof(req: any): { scheme: string, macaroon?: string, preimage: string, chargeId?: string } | null {
        if (!req || !req.headers) return null;
        
        const authHeader = typeof req.headers.get === 'function' 
            ? req.headers.get('Authorization') 
            : req.headers['authorization'] || req.headers['Authorization'];

        if (!authHeader) return null;

        const upperAuth = authHeader.toUpperCase();

        // --- L402 ---
        if (upperAuth.startsWith('L402 ')) {
            const parts = authHeader.substring(5).trim().split(':');
            if (parts.length !== 2) return null;
            return { scheme: 'L402', macaroon: parts[0], preimage: parts[1] };
        } 
        // --- MPP (標準 & レガシー) ---
        else if (upperAuth.startsWith('PAYMENT ')) {
            const credential = authHeader.substring(8).trim();
            if (credential.includes(':')) {
                const parts = credential.split(':');
                return { scheme: 'MPP', chargeId: parts[0], preimage: parts[1] };
            } else {
                return { scheme: 'MPP', preimage: credential };
            }
        }
        return null;
    }

    public canHandle(req: any): boolean {
        return this.extractProof(req) !== null;
    }

    public getChallengeContext(): Record<string, any> {
        return {
            guide: "L402 or MPP payment required. Fetch an invoice, pay it via Lightning Network, and set the standard Authorization header.",
            next_request_schema: {
                headers: {
                    Authorization: "L402 <macaroon>:<preimage> OR Payment <preimage>"
                }
            }
        };
    }

    public async verify(req: any): Promise<VerifyResult> {
        const proof = this.extractProof(req);
        if (!proof) return { isValid: false, error: "Missing or invalid Authorization header." };

        try {
            const calculatedHash = crypto.createHash('sha256').update(Buffer.from(proof.preimage, 'hex')).digest('hex');

            if (proof.scheme === 'L402') {
                const macaroonObj = MacaroonsBuilder.deserialize(proof.macaroon!);
                const verifier = new MacaroonsVerifier(macaroonObj);
                verifier.satisfyExact(`payment_hash=${calculatedHash}`);

                if (!verifier.isValid(this.config.macaroonSecret || "")) {
                    return { isValid: false, error: "Macaroon signature invalid." };
                }

                let settledAmount = null;
                const caveats = macaroonObj.exportJSON().c || []; 
                for (const caveat of caveats) {
                    if (caveat.cid && caveat.cid.startsWith('amount=')) {
                        settledAmount = parseInt(caveat.cid.split('=')[1], 10);
                    }
                }
                if (settledAmount === null) return { isValid: false, error: "Missing 'amount' caveat." };

                return { isValid: true, scheme: 'L402', payload: { agentId: "l402-agent", settledAmount, asset: 'SATS', receiptId: calculatedHash } };
            } 
            else if (proof.scheme === 'MPP') {
                if (proof.chargeId && calculatedHash !== proof.chargeId) {
                    return { isValid: false, error: "Preimage hash mismatch." };
                }
                // ⚠️ 簡易実装: MPPは本来Nodeへの問い合わせが必要ですが、スターターキットの簡略化としてハッシュ照合を正とします
                return { isValid: true, scheme: 'MPP', payload: { agentId: "mpp-agent", settledAmount: 0 /* 要バックエンド連動 */, asset: 'SATS', receiptId: calculatedHash } };
            }

            return { isValid: false, error: "Unknown routing error." };
        } catch (e: any) {
            return { isValid: false, error: `Verification failed: ${e.message}` };
        }
    }
}