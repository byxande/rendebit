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
