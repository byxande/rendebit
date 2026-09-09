import { describe, expect, it } from "vitest";
import {
  sandboxBinanceLiquidityProvider,
  sandboxCustodyProvider,
  sandboxKycProvider,
  sandboxPixProvider,
  sandboxProfitConversionQuoteProvider,
  sandboxSbtcConversionProvider,
  sandboxYieldProvider,
} from "./sandbox";

describe("provedores sandbox", () => {
  it("retorna identificadores determinísticos e resultados simulados", async () => {
    const kyc = await sandboxKycProvider.verifyIdentity({ userId: 7, cpfMasked: "•••.000.•••-••" });
    const pix = await sandboxPixProvider.settleCashIn({ purchaseId: 9, amountBrl: "1000.00", idempotencyKey: "pix-9" });
    const custody = await sandboxCustodyProvider.buyBitcoin({ purchaseId: 9, btcAmount: "0.00240000", idempotencyKey: "custody-9" });
    const binanceOrder = await sandboxBinanceLiquidityProvider.buyBitcoin({ purchaseId: 9, amountBrl: "1000.00", btcAmount: "0.00240000", executionBtcBrl: "416666.67", idempotencyKey: "binance-9" });
    const executableQuote = await sandboxProfitConversionQuoteProvider.quote({ sweepId: 14, amountBrl: "1000.00", destinationAsset: "stBTC", slippageBps: 50, idempotencyKey: "quote-14" });
    const sbtcConversion = await sandboxSbtcConversionProvider.convertBtcToSbtc({ purchaseId: 9, btcAmount: "0.00240000", idempotencyKey: "sbtc-9" });
    const yieldPosition = await sandboxYieldProvider.activatePosition({ purchaseId: 9, sbtcAmount: sbtcConversion.payload.sbtcAmount, idempotencyKey: "yield-9" });
    const yieldExit = await sandboxYieldProvider.exitPosition?.({ redemptionId: 12, btcAmount: "0.00100000", idempotencyKey: "yield-exit-12" });
    const conversion = await sandboxCustodyProvider.sellBitcoin({ redemptionId: 12, btcAmount: "0.00100000", grossBrl: "421.93", idempotencyKey: "sell-12" });
    const pixOut = await sandboxPixProvider.settleCashOut({ redemptionId: 12, amountBrl: "419.40", pixDestinationMasked: "Banco Sandbox •••• 0000", idempotencyKey: "pix-out-12" });

    expect(kyc).toMatchObject({ externalId: "kyc-sandbox-7", status: "approved" });
    expect(pix).toMatchObject({ externalId: "pix-sandbox-9", status: "settled" });
    expect(custody).toMatchObject({ externalId: "custody-sandbox-9", status: "settled" });
    expect(binanceOrder).toMatchObject({ externalId: "binance-btcbrl-sandbox-9", status: "settled" });
    expect(binanceOrder.payload).toMatchObject({ symbol: "BTCBRL", status: "filled", btcAmount: "0.00240000" });
    expect(executableQuote).toMatchObject({ externalId: "profit-quote-sandbox-14", status: "active" });
    expect(executableQuote.payload.route).toBe("BRL>BTC>sBTC>stBTC");
    expect(Number(executableQuote.payload.estimatedAssetAmount)).toBeGreaterThan(0);
    expect(Number(executableQuote.payload.minimumAssetAmount)).toBeLessThan(
      Number(executableQuote.payload.estimatedAssetAmount)
    );
    expect(new Date(executableQuote.payload.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const execution = await sandboxProfitConversionQuoteProvider.execute({
      sweepId: 14,
      quoteExternalId: executableQuote.externalId,
      amountBrl: executableQuote.payload.amountBrl,
      estimatedAssetAmount: executableQuote.payload.estimatedAssetAmount,
      minimumAssetAmount: executableQuote.payload.minimumAssetAmount,
      idempotencyKey: "execute-14",
    });
    expect(execution.payload.transactionId).toBe(execution.externalId);
    await expect(
      sandboxProfitConversionQuoteProvider.execute({
        sweepId: 14,
        quoteExternalId: "quote-unknown",
        amountBrl: "1000.00",
        estimatedAssetAmount: "0.00200000",
        minimumAssetAmount: "0.00100000",
        idempotencyKey: "execute-14-replay",
      })
    ).rejects.toThrow("Cotação sandbox desconhecida");
    expect(sbtcConversion).toMatchObject({ externalId: "sbtc-conversion-sandbox-9", status: "settled" });
    expect(sbtcConversion.payload.route).toBe("BTC>sBTC");
    expect(yieldPosition.payload.route).toBe("BTC>sBTC>stBTC");
    expect(yieldExit).toMatchObject({ externalId: "stacks-exit-sandbox-12", status: "settled" });
    expect(conversion).toMatchObject({ externalId: "sell-sandbox-12", status: "settled" });
    expect(pixOut).toMatchObject({ externalId: "pix-out-sandbox-12", status: "settled" });
  });
});
