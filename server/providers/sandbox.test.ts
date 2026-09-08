import { describe, expect, it } from "vitest";
import {
  sandboxCustodyProvider,
  sandboxKycProvider,
  sandboxPixProvider,
  sandboxYieldProvider,
} from "./sandbox";

describe("provedores sandbox", () => {
  it("retorna identificadores determinísticos e resultados simulados", async () => {
    const kyc = await sandboxKycProvider.verifyIdentity({ userId: 7, cpfMasked: "•••.000.•••-••" });
    const pix = await sandboxPixProvider.settleCashIn({ purchaseId: 9, amountBrl: "1000.00", idempotencyKey: "pix-9" });
    const custody = await sandboxCustodyProvider.buyBitcoin({ purchaseId: 9, btcAmount: "0.00240000", idempotencyKey: "custody-9" });
    const yieldPosition = await sandboxYieldProvider.activatePosition({ purchaseId: 9, btcAmount: "0.00240000", idempotencyKey: "yield-9" });

    expect(kyc).toMatchObject({ externalId: "kyc-sandbox-7", status: "approved" });
    expect(pix).toMatchObject({ externalId: "pix-sandbox-9", status: "settled" });
    expect(custody).toMatchObject({ externalId: "custody-sandbox-9", status: "settled" });
    expect(yieldPosition.payload.route).toBe("BTC>sBTC>stBTC");
  });
});
