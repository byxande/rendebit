import type { CustodyProvider, KycProvider, PixProvider, YieldProvider } from "./types";

const sandboxId = (prefix: string, stableId: number) => `${prefix}-sandbox-${stableId}`;

export const sandboxKycProvider: KycProvider = {
  async verifyIdentity({ userId }) {
    return {
      externalId: sandboxId("kyc", userId),
      status: "approved",
      payload: { taxStatus: "regular" },
    };
  },
};

export const sandboxPixProvider: PixProvider = {
  async createCashInCharge({ depositId, amountBrl, expiresAt }) {
    const reference = sandboxId("pix-charge", depositId);
    const pixCopyPaste = `00020101021226850014BR.GOV.BCB.PIX2563sandbox.rendebit.local/pix/${reference}520400005303986540${amountBrl.replace(".", "")}5802BR5917RENDEBIT SANDBOX6009SAO PAULO62070503***6304DEMO`;
    return {
      externalId: reference,
      status: "active",
      payload: { amountBrl, pixCopyPaste, qrCodeText: pixCopyPaste, expiresAt: expiresAt.toISOString() },
    };
  },
  async confirmCashInCharge({ depositId, amountBrl }) {
    const endToEndId = `E0000000020260908${String(depositId).padStart(14, "0")}`;
    return {
      externalId: sandboxId("pix-deposit", depositId),
      status: "settled",
      payload: { amountBrl, endToEndId },
    };
  },
  async settleCashIn({ purchaseId, amountBrl }) {
    return {
      externalId: sandboxId("pix", purchaseId),
      status: "settled",
      payload: { amountBrl },
    };
  },
  async settleCashOut({ redemptionId, amountBrl, pixDestinationMasked }) {
    return {
      externalId: sandboxId("pix-out", redemptionId),
      status: "settled",
      payload: { amountBrl, pixDestinationMasked },
    };
  },
};

export const sandboxCustodyProvider: CustodyProvider = {
  async buyBitcoin({ purchaseId, btcAmount }) {
    return {
      externalId: sandboxId("custody", purchaseId),
      status: "settled",
      payload: { btcAmount },
    };
  },
  async sellBitcoin({ redemptionId, btcAmount, grossBrl }) {
    return {
      externalId: sandboxId("sell", redemptionId),
      status: "settled",
      payload: { btcAmount, grossBrl },
    };
  },
};

export const sandboxYieldProvider: YieldProvider = {
  provider: "sandbox_stacks",
  network: "sandbox",
  async activatePosition({ purchaseId, btcAmount }) {
    return {
      externalId: sandboxId("stacks", purchaseId),
      status: "active",
      payload: { btcAmount, route: "BTC>sBTC>stBTC" },
    };
  },
  async exitPosition({ redemptionId, btcAmount }) {
    return {
      externalId: sandboxId("stacks-exit", redemptionId),
      status: "settled",
      payload: { btcAmount, route: "stBTC>sBTC>BTC", network: "sandbox" },
    };
  },
};
