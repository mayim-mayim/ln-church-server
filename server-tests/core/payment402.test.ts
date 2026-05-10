// packages/core/test/payment402.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Payment402, PaymentVerifier, VerifyResult, ReceiptStore } from '../../packages/core/src/index';


describe('Payment402 Core Engine', () => {
    // 成功するモック検証器
    const mockSuccessVerifier: PaymentVerifier = {
        canHandle: () => true,
        verify: async () => ({
            isValid: true,
            scheme: 'mock-scheme',
            payload: { agentId: 'agent-1', settledAmount: 10, asset: 'SATS', receiptId: 'receipt-123' }
        }),
        getChallengeContext: () => ({ guide: 'Mock challenge' })
    };

    // 失敗するモック検証器
    const mockFailVerifier: PaymentVerifier = {
        canHandle: () => true,
        verify: async () => ({ isValid: false, error: 'Invalid signature' }),
        getChallengeContext: () => ({ guide: 'Mock challenge' })
    };

    it('should pass if the payment meets the requirements', async () => {
        const payment402 = new Payment402([mockSuccessVerifier]);
        const result = await payment402.verify({}, { amount: 10, asset: 'SATS' });
        
        expect(result.isValid).toBe(true);
        expect(result.payload?.settledAmount).toBe(10);
    });

    it('should fail if the asset or amount does not match', async () => {
        const payment402 = new Payment402([mockSuccessVerifier]);
        // 20 SATS 要求しているのに 10 SATS しか払っていないケース
        const result = await payment402.verify({}, { amount: 20, asset: 'SATS' });
        
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Payment insufficient');
    });

    it('should fail on replay attack if receipt is already used', async () => {
        // 使用済み（false）を返すモックストア
        const mockStore: ReceiptStore = { checkAndStore: async () => false };
        const payment402 = new Payment402([mockSuccessVerifier], { receiptStore: mockStore });
        
        const result = await payment402.verify({}, { amount: 10, asset: 'SATS' });
        
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Replay detected');
    });

    it('should return error if verifier fails', async () => {
        const payment402 = new Payment402([mockFailVerifier]);
        const result = await payment402.verify({}, { amount: 10, asset: 'SATS' });
        
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid signature');
    });
});