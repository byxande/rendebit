import { describe, expect, it } from "vitest";
import {
  sandboxCustodyProvider,
  sandboxKycProvider,
  sandboxPixProvider,
  sandboxSbtcConversionProvider,
  sandboxYieldProvider,
} from "./sandbox";

describe("provedores sandbox", () => {
  it("retorna identificadores determinísticos e resultados simulados", async () => {
    const kyc = await sandboxKycProvider.verifyIdentity({ userId: 7, cpfMasked: "•••.000.•••-••" });
    const pix = await sandboxPixProvider.settleCashIn({ purchaseId: 9, amountBrl: "1000.00", idempotencyKey: "pix-9" });
    const custody = await sandboxCustodyProvider.buyBitcoin({ purchaseId: 9, btcAmount: "0.00240000", idempotencyKey: "custody-9" });
    const sbtcConversion = await sandboxSbtcConversionProvider.convertBtcToSbtc({ purchaseId: 9, btcAmount: "0.00240000", idempotencyKey: "sbtc-9" });
    const yieldPosition = await sandboxYieldProvider.activatePosition({ purchaseId: 9, sbtcAmount: sbtcConversion.payload.sbtcAmount, idempotencyKey: "yield-9" });
    const yieldExit = await sandboxYieldProvider.exitPosition?.({ redemptionId: 12, btcAmount: "0.00100000", idempotencyKey: "yield-exit-12" });
    const conversion = await sandboxCustodyProvider.sellBitcoin({ redemptionId: 12, btcAmount: "0.00100000", grossBrl: "421.93", idempotencyKey: "sell-12" });
    const pixOut = await sandboxPixProvider.settleCashOut({ redemptionId: 12, amountBrl: "419.40", pixDestinationMasked: "Banco Sandbox •••• 0000", idempotencyKey: "pix-out-12" });

    expect(kyc).toMatchObject({ externalId: "kyc-sandbox-7", status: "approved" });
    expect(pix).toMatchObject({ externalId: "pix-sandbox-9", status: "settled" });
    expect(custody).toMatchObject({ externalId: "custody-sandbox-9", status: "settled" });
    expect(sbtcConversion).toMatchObject({ externalId: "sbtc-conversion-sandbox-9", status: "settled" });
    expect(sbtcConversion.payload.route).toBe("BTC>sBTC");
    expect(yieldPosition.payload.route).toBe("BTC>sBTC>stBTC");
    expect(yieldExit).toMatchObject({ externalId: "stacks-exit-sandbox-12", status: "settled" });
    expect(conversion).toMatchObject({ externalId: "sell-sandbox-12", status: "settled" });
    expect(pixOut).toMatchObject({ externalId: "pix-out-sandbox-12", status: "settled" });
  });
});
