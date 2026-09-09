import { describe, expect, it } from "vitest";
import {
  binanceBtcLiquidityConfig,
  createBinanceBtcLiquidityProvider,
} from "./binance";

describe("provider Binance BTCBRL", () => {
  it("mantém a liquidez real bloqueada sem secrets e gate operacional", async () => {
    const provider = createBinanceBtcLiquidityProvider();

    if (
      !binanceBtcLiquidityConfig.configured ||
      !binanceBtcLiquidityConfig.realExecutionEnabled
    ) {
      await expect(
        provider.preflight?.({
          purchaseId: 42,
          amountBrl: "1000.00",
          btcAmount: "0.00240000",
          idempotencyKey: "binance-preflight-42",
        })
      ).rejects.toThrow(/Binance não configurada|permanece bloqueada/);
    }
  });
});
