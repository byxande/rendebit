export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "",
  mercadoPagoAccessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
  mercadoPagoWebhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "",
  mercadoPagoMode:
    process.env.MERCADO_PAGO_MODE === "production"
      ? ("production" as const)
      : ("test" as const),
  paymentsProvider:
    process.env.PAYMENTS_PROVIDER === "mercado_pago"
      ? ("mercado_pago" as const)
      : ("sandbox" as const),
  binanceApiKey: process.env.BINANCE_API_KEY ?? "",
  binanceApiSecret: process.env.BINANCE_API_SECRET ?? "",
  realBtcLiquidityEnabled:
    process.env.RENDEBIT_ENABLE_REAL_BINANCE_LIQUIDITY === "true",
  binanceMaxSlippageBps: Math.min(
    500,
    Math.max(0, Number(process.env.BINANCE_MAX_SLIPPAGE_BPS ?? 50) || 50)
  ),
};
