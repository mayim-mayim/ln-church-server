import { describe, test, expect } from 'vitest';
import { Payment402, PaymentRequirement } from '../src/index';

describe('Payment402 Canonical Provider Contract', () => {
    // モック用のVerifier（今回はヘッダーテストなので空でOK）
    const payment402 = new Payment402([]);
    const mockReq: PaymentRequirement = { amount: 50, asset: "SATS" };

    test('buildChallengeHeaders generates strict standard headers', () => {
        const headers = payment402.buildChallengeHeaders(mockReq);
        
        expect(headers['WWW-Authenticate']).toBe('Payment invoice="<fetch-via-hateoas>", charge="<fetch-via-hateoas>"');
        expect(headers['x-402-payment-required']).toBe('price=50; asset=SATS; network=lightning');
        expect(headers['PAYMENT-REQUIRED']).toBe('network="lightning", amount="50", asset="SATS"');
    });

    test('buildSuccessReceiptHeaders generates standard receipt headers', () => {
        const fakeToken = "base64-encoded-receipt-token";
        const headers = payment402.buildSuccessReceiptHeaders(fakeToken);

        expect(headers['PAYMENT-RESPONSE']).toBe('status="success", receipt="base64-encoded-receipt-token"');
        expect(headers['Payment-Receipt']).toBe('base64-encoded-receipt-token');
    });
});