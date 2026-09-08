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
};

export const sandboxCustodyProvider: CustodyProvider = {
  async buyBitcoin({ purchaseId, btcAmount }) {
    return {
      externalId: sandboxId("custody", purchaseId),
      status: "settled",
      payload: { btcAmount },
    };
  },
};

export const sandboxYieldProvider: YieldProvider = {
  async activatePosition({ purchaseId, btcAmount }) {
    return {
      externalId: sandboxId("stacks", purchaseId),
      status: "active",
      payload: { btcAmount, route: "BTC>sBTC>stBTC" },
    };
  },
};
