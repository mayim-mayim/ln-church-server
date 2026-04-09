// packages/core/src/index.ts

export interface VerifyResult {
    isValid: boolean;
    scheme?: string;
    amount?: number;
    asset?: string;
    payload?: {
        agentId: string;
        settledAmount: number;
        asset: string;
        receiptId: string;
    };
    error?: string;
}

export interface PaymentVerifier {
    canHandle(req: any): boolean;
    verify(req: any): Promise<VerifyResult>;
    getChallengeContext(): Record<string, any>;
}

// 要求額の型を定義
export interface PaymentRequirement {
    amount: number;
    asset: string;
}

export class Payment402 {
    constructor(private verifiers: PaymentVerifier[]) {}

    // 2. verifyメソッドに requirement パラメータを追加
    public async verify(req: any, requirement?: PaymentRequirement): Promise<VerifyResult> {
        // ※ここでは既存の verifier ループ処理があると仮定しています
        let authResult: VerifyResult = { isValid: false, error: "No valid payment proof provided." };

        for (const verifier of this.verifiers) {
            if (verifier.canHandle(req)) {
                authResult = await verifier.verify(req);
                break; // 処理できるVerifierが見つかったら検証して抜ける
            }
        }

        // 🛡️ 3. 新機能：コア側で金額とアセットを厳格に比較する
        if (authResult.isValid && requirement) {
            const settledAmount = authResult.payload?.settledAmount || 0;
            const settledAsset = authResult.payload?.asset || "UNKNOWN";

            if (settledAmount < requirement.amount || settledAsset !== requirement.asset) {
                // 要求額を満たしていない場合は、心を鬼にして false に上書きする
                return {
                    isValid: false,
                    error: `Payment insufficient or asset mismatch. Required: ${requirement.amount} ${requirement.asset}, Settled: ${settledAmount} ${settledAsset}`,
                    payload: authResult.payload
                };
            }
        }

        return authResult;
    }

    // お金がない時に返す「完璧なHATEOAS（402エラー）」を生成する
    buildHateoasResponse(price: number, asset: string) {
        // 登録されている全プラグインからAI向けの指示書（カンペ）をかき集める
        const instructions = this.verifiers.map(v => v.getChallengeContext());
        
        return {
            error: "Payment Required",
            message: `奉納額 ${price} ${asset} が必要です。`,
            challenge: { amount: price, asset: asset },
            instruction_for_agents: instructions
        };
    }
}