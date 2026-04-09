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
    canHandle(req: Request, body: any): boolean;
    verify(req: Request, body: any): Promise<VerifyResult>;
    getChallengeContext(): Record<string, any>;
}

export class Payment402 {
    constructor(private verifiers: PaymentVerifier[]) {}

    // リクエストを解析し、適切なプラグインに検証を回す
    async verify(req: Request): Promise<VerifyResult> {
        try {
            // HonoなどのRequestオブジェクトは一度しか読めないためcloneする
            const clonedReq = req.clone();
            const body = await clonedReq.json().catch(() => ({}));

            // 処理可能なプラグインを探す
            const verifier = this.verifiers.find(v => v.canHandle(req, body));

            if (verifier) {
                return await verifier.verify(req, body); // 丸投げ！
            }

            return { isValid: false, error: "Payment Required or Unsupported Scheme" };
        } catch (e: any) {
            return { isValid: false, error: e.message };
        }
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