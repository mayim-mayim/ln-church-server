import { PaymentVerifier } from '@ln-church/server';

export interface L402Config {
    // LNDのノードURLや、Macaroonの署名検証に使うシークレットなどが入る想定
    nodeUrl?: string;
    macaroonSecret?: string;
}

export class L402Verifier implements PaymentVerifier {
    public readonly scheme = 'l402';

    constructor(private config: L402Config = {}) {}

    // 1. このプラグインが処理できる証明（proof）かどうかを判定
    public canHandle(proof: any): boolean {
        return proof && typeof proof === 'object' && 'macaroon' in proof && 'preimage' in proof;
    }

    // 2. AIエージェントに「L402で支払え」という指示とスキーマを出す（引数なしに修正！）
    public getChallengeContext(): Record<string, any> {
        return {
            guide: "L402 payment required. Fetch an invoice, pay it via Lightning Network, and provide the Macaroon and Preimage.",
            next_request_schema: {
                paymentOverride: {
                    type: this.scheme,
                    proof: {
                        macaroon: "BASE64_MACAROON_STRING",
                        preimage: "HEX_PREIMAGE_STRING"
                    }
                    // assetはcore側で処理されるはずなのでここからは削除
                }
            }
        };
    }

    // 3. 支払いの証明（Macaroon + Preimage）を検証する
    public async verify(proof: any): Promise<{ isValid: boolean; amount?: number; asset?: string; error?: string }> {
        if (!this.canHandle(proof)) {
            return { isValid: false, error: "Invalid L402 proof format. Required: macaroon and preimage." };
        }

        const { macaroon, preimage } = proof;

        try {
            // ==========================================
            // TODO: ここに本気のL402検証ロジックを書く！
            // ==========================================

            // 仮実装：preimageが32文字以上あればヨシとする
            if (preimage.length >= 32) {
                return { isValid: true, amount: 0, asset: 'SATS' }; 
            } else {
                 return { isValid: false, error: "Invalid preimage." };
            }

        } catch (e: any) {
            return { isValid: false, error: `L402 Verification failed: ${e.message}` };
        }
    }
}