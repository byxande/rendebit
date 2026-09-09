export type ProviderResult<T> = {
  externalId: string;
  status: "approved" | "settled" | "active" | "pending";
  payload: T;
};

export type PurchasePaymentMethod = "pix" | "credit_card";

export interface BtcLiquidityProvider {
  provider: "sandbox_binance" | "binance";
  mode: "sandbox" | "test" | "production";
  preflight?(input: {
    purchaseId: number;
    amountBrl: string;
    btcAmount: string;
    idempotencyKey: string;
  }): Promise<void>;
  buyBitcoin(input: {
    purchaseId: number;
    amountBrl: string;
    btcAmount: string;
    executionBtcBrl: string;
    idempotencyKey: string;
  }): Promise<
    ProviderResult<{
      amountBrl: string;
      btcAmount: string;
      executionBtcBrl: string;
      symbol: "BTCBRL";
      orderId: string;
      status: "filled" | "partially_filled" | "created";
    }>
  >;
}

export interface ProfitConversionQuoteProvider {
  provider: "sandbox_quote" | "institutional_exchange";
  quote(input: {
    sweepId: number;
    amountBrl: string;
    destinationAsset: "stBTC";
    slippageBps: number;
    idempotencyKey: string;
  }): Promise<
    ProviderResult<{
      amountBrl: string;
      referenceAssetBrl: string;
      estimatedAssetAmount: string;
      minimumAssetAmount: string;
      expiresAt: string;
      route: "BRL>BTC>sBTC>stBTC";
    }>
  >;
  execute(input: {
    sweepId: number;
    quoteExternalId: string;
    amountBrl: string;
    estimatedAssetAmount: string;
    minimumAssetAmount: string;
    idempotencyKey: string;
  }): Promise<
    ProviderResult<{
      amountBrl: string;
      estimatedAssetAmount: string;
      minimumAssetAmount: string;
      route: "BRL>BTC>sBTC>stBTC";
      transactionId: string;
    }>
  >;
}

export interface KycProvider {
  verifyIdentity(input: {
    userId: number;
    cpfMasked: string;
  }): Promise<ProviderResult<{ taxStatus: "regular" }>>;
}

export interface PixProvider {
  createCashInCharge(input: {
    depositId: number;
    amountBrl: string;
    expiresAt: Date;
    idempotencyKey: string;
  }): Promise<
    ProviderResult<{
      amountBrl: string;
      pixCopyPaste: string;
      qrCodeText: string;
      expiresAt: string;
    }>
  >;
  confirmCashInCharge(input: {
    depositId: number;
    amountBrl: string;
    idempotencyKey: string;
  }): Promise<ProviderResult<{ amountBrl: string; endToEndId: string }>>;
  settleCashIn(input: {
    purchaseId: number;
    amountBrl: string;
    idempotencyKey: string;
  }): Promise<ProviderResult<{ amountBrl: string }>>;
  settleCashOut(input: {
    redemptionId: number;
    amountBrl: string;
    pixDestinationMasked: string;
    idempotencyKey: string;
  }): Promise<
    ProviderResult<{ amountBrl: string; pixDestinationMasked: string }>
  >;
}

export interface PurchasePaymentProvider {
  provider: "sandbox_payments" | "mercado_pago";
  mode: "sandbox" | "test" | "production";
  createCheckout(input: {
    purchaseId: number;
    amountBrl: string;
    payerEmail: string | null;
    paymentMethod: PurchasePaymentMethod;
    idempotencyKey: string;
    returnBaseUrl: string;
  }): Promise<
    ProviderResult<{
      checkoutUrl: string | null;
      paymentMethod: PurchasePaymentMethod;
      paymentStatus: "pending" | "approved";
    }>
  >;
}

export interface CustodyProvider {
  buyBitcoin(input: {
    purchaseId: number;
    btcAmount: string;
    idempotencyKey: string;
  }): Promise<ProviderResult<{ btcAmount: string }>>;
  sellBitcoin(input: {
    redemptionId: number;
    btcAmount: string;
    grossBrl: string;
    idempotencyKey: string;
  }): Promise<ProviderResult<{ btcAmount: string; grossBrl: string }>>;
}

export interface SbtcConversionProvider {
  provider: "sandbox_custody" | "stacks_testnet";
  network: "sandbox" | "testnet";
  preflight?(input: {
    purchaseId: number;
    btcAmount: string;
    idempotencyKey: string;
  }): Promise<void>;
  convertBtcToSbtc(input: {
    purchaseId: number;
    btcAmount: string;
    idempotencyKey: string;
  }): Promise<
    ProviderResult<{
      btcAmount: string;
      sbtcAmount: string;
      route: "BTC>sBTC";
      network?: "sandbox" | "testnet";
      txid?: string;
    }>
  >;
}

export interface YieldProvider {
  provider: "sandbox_stacks" | "stacks_testnet";
  network: "sandbox" | "testnet";
  preflight?(input: {
    purchaseId: number;
    btcAmount: string;
    idempotencyKey: string;
  }): Promise<void>;
  activatePosition(input: {
    purchaseId: number;
    sbtcAmount: string;
    idempotencyKey: string;
    customerWalletAddress?: string;
  }): Promise<
    ProviderResult<{
      btcAmount: string;
      sbtcAmount: string;
      route: "BTC>sBTC>stBTC";
      network?: "sandbox" | "testnet";
      txid?: string;
      amountSats?: string;
      minSharesOut?: string;
      ratio?: string;
    }>
  >;
  exitPosition?(input: {
    redemptionId: number;
    btcAmount: string;
    idempotencyKey: string;
  }): Promise<
    ProviderResult<{
      btcAmount: string;
      route: "stBTC>sBTC>BTC";
      network?: "sandbox" | "testnet";
      txid?: string;
    }>
  >;
}
