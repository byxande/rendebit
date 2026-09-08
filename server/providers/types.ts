export type ProviderResult<T> = {
  externalId: string;
  status: "approved" | "settled" | "active";
  payload: T;
};

export interface KycProvider {
  verifyIdentity(input: { userId: number; cpfMasked: string }): Promise<ProviderResult<{ taxStatus: "regular" }>>;
}

export interface PixProvider {
  settleCashIn(input: { purchaseId: number; amountBrl: string; idempotencyKey: string }): Promise<ProviderResult<{ amountBrl: string }>>;
}

export interface CustodyProvider {
  buyBitcoin(input: { purchaseId: number; btcAmount: string; idempotencyKey: string }): Promise<ProviderResult<{ btcAmount: string }>>;
}

export interface YieldProvider {
  activatePosition(input: { purchaseId: number; btcAmount: string; idempotencyKey: string }): Promise<ProviderResult<{ btcAmount: string; route: "BTC>sBTC>stBTC" }>>;
}
