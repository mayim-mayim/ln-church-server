
export interface VerifyResult {
    isValid: boolean;
    scheme?: string;
    payload?: {
        agentId: string;
        settledAmount: number;
        asset: string;
        receiptId: string;
        // --- Grant拡張 ---
        issuer?: string;
        grantId?: string;
        grantType?: string;
        scope?: any;
    };
    error?: string;
}

export interface PaymentVerifier {
    // ボディ（paymentOverride）を安全にパースするため Promise を許容
    canHandle(req: any): boolean | Promise<boolean>;
    verify(req: any): Promise<VerifyResult>;
    getChallengeContext(): Record<string, any>;
}

export interface PaymentRequirement {
    amount: number;
    asset: string;
}

export interface ReceiptStore {
    checkAndStore(receiptId: string): Promise<boolean>;
}

export interface ChallengeHeaders extends Record<string, string> {
    'WWW-Authenticate': string;
    'x-402-payment-required': string;
    'PAYMENT-REQUIRED': string;
}

export interface ReceiptHeaders extends Record<string, string> {
    'PAYMENT-RESPONSE': string;
    'Payment-Receipt': string;
}

export interface ChallengeOptions {
    scheme?: string;   // デフォルト: 'Payment'
    network?: string;  // デフォルト: 'lightning'
}

export class Payment402 {
    private receiptStore?: ReceiptStore;

    // オプションで ReceiptStore を受け取れる
    constructor(private verifiers: PaymentVerifier[], options?: { receiptStore?: ReceiptStore }) {
        this.receiptStore = options?.receiptStore;
    }

    // 🌟 Requirement を配列（複数決済手段のOR条件）で受け取れる
    public async verify(req: any, requirements?: PaymentRequirement | PaymentRequirement[]): Promise<VerifyResult> {
        let authResult: VerifyResult = { isValid: false, error: "No valid payment proof provided." };

        for (const verifier of this.verifiers) {
            if (await verifier.canHandle(req)) {
                authResult = await verifier.verify(req);
                break;
            }
        }

        if (!authResult.isValid) return authResult;

        // 🛡️ マルチアセット対応の価格検証
        if (requirements) {
            // 単一オブジェクトでも配列に変換して一括処理
            const reqArray = Array.isArray(requirements) ? requirements : [requirements];
            const settledAmount = authResult.payload?.settledAmount || 0;
            const settledAsset = authResult.payload?.asset || "UNKNOWN";

            // 提示された要求の「どれか一つ」でも満たしていれば isMet = true
            const isMet = reqArray.some(req => settledAmount >= req.amount && settledAsset === req.asset);

            if (!isMet) {
                return {
                    isValid: false,
                    // エラーメッセージもundefinedが出ないように修正
                    error: `Payment insufficient or asset mismatch. Settled: ${settledAmount} ${settledAsset}`,
                    payload: authResult.payload
                };
            }
        }

        // 🛡️ リプレイ攻撃防御
        if (this.receiptStore && authResult.payload?.receiptId) {
            const isUnique = await this.receiptStore.checkAndStore(authResult.payload.receiptId);
            if (!isUnique) {
                return { isValid: false, error: "Payment receipt has already been used (Replay detected)." };
            }
        }

        return authResult;
    }

    // 🌟 新規追加: Provider Contract の標準化 (Challenge)
    public buildChallengeHeaders(
        requirements: PaymentRequirement | PaymentRequirement[], 
        options?: ChallengeOptions
    ): ChallengeHeaders {
        const reqArray = Array.isArray(requirements) ? requirements : [requirements];
        const primaryReq = reqArray[0];
        
        const scheme = options?.scheme || "Payment";
        const network = options?.network || "lightning";

        return {
            'WWW-Authenticate': `${scheme} invoice="<fetch-via-hateoas>", charge="<fetch-via-hateoas>"`,
            'x-402-payment-required': `price=${primaryReq.amount}; asset=${primaryReq.asset}; network=${network}`,
            'PAYMENT-REQUIRED': `network="${network}", amount="${primaryReq.amount}", asset="${primaryReq.asset}"`
        };
    }

    // 🌟 新規追加: Provider Contract の標準化 (Receipt)
    public buildSuccessReceiptHeaders(receiptToken: string): ReceiptHeaders {
        return {
            'PAYMENT-RESPONSE': `status="success", receipt="${receiptToken}"`,
            'Payment-Receipt': receiptToken
        };
    }

    buildHateoasResponse(requirements: PaymentRequirement | PaymentRequirement[]) {
        const reqArray = Array.isArray(requirements) ? requirements : [requirements];
        const instructions = this.verifiers.map(v => v.getChallengeContext());
        const primaryReq = reqArray[0]; 

        return {
            error: "Payment Required",
            message: `奉納額 ${primaryReq.amount} ${primaryReq.asset} が必要です。`,
            challenge: {
                scheme: "Payment", // MPP標準をデフォルトに寄せる
                network: "lightning",
                amount: primaryReq.amount,
                asset: primaryReq.asset,
                parameters: {
                    invoice: "<fetch-via-hateoas>", 
                    paymentHash: "<fetch-via-hateoas>"
                }
            },
            instruction_for_agents: {
                guide: "Pay LN invoice and return standard Payment header.",
                steps: [
                    "1. Pay invoice",
                    "2. Re-POST with Authorization: Payment <preimage>"
                ],
                next_request_schema: {
                    scheme: "MPP",
                    asset: primaryReq.asset,
                    amount: primaryReq.amount
                },
                options: instructions 
            }
        };
    }
}