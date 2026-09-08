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
  provider: "sandbox_stacks" | "stacks_testnet";
  network: "sandbox" | "testnet";
  preflight?(input: { purchaseId: number; btcAmount: string; idempotencyKey: string }): Promise<void>;
  activatePosition(input: { purchaseId: number; btcAmount: string; idempotencyKey: string }): Promise<ProviderResult<{
    btcAmount: string;
    route: "BTC>sBTC>stBTC";
    network?: "sandbox" | "testnet";
    txid?: string;
    amountSats?: string;
    minSharesOut?: string;
    ratio?: string;
  }>>;
}
