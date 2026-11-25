import api from './client';

export interface PaymentCreateResponse {
  payment_id: string;
  confirmation_url: string;
  amount: string;
  currency: string;
}

export interface PremiumStatusResponse {
  is_premium: boolean;
  expires_at: string | null;
  days_left: number | null;
}

export const paymentsApi = {
  createSubscription: (): Promise<PaymentCreateResponse> =>
    api.post('/payments/create-subscription').then(r => r.data),

  getStatus: (): Promise<PremiumStatusResponse> =>
    api.get('/payments/status').then(r => r.data),

  checkPayment: (paymentId: string): Promise<PremiumStatusResponse> =>
    api.post(`/payments/check/${paymentId}`).then(r => r.data),
};
