import { calculateProfitStbtcSweep, SANDBOX_BTC_BRL } from "../finance";
import type {
  CustodyProvider,
  KycProvider,
  PixProvider,
  ProfitConversionQuoteProvider,
  PurchasePaymentProvider,
  SbtcConversionProvider,
  YieldProvider,
} from "./types";

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

export const sandboxPurchasePaymentProvider: PurchasePaymentProvider = {
  provider: "sandbox_payments",
  mode: "sandbox",
  async createCheckout({ purchaseId, paymentMethod }) {
    return {
      externalId: sandboxId("payment", purchaseId),
      status: "approved",
      payload: { checkoutUrl: null, paymentMethod, paymentStatus: "approved" },
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

export const sandboxProfitConversionQuoteProvider: ProfitConversionQuoteProvider = {
  provider: "sandbox_quote",
  async quote({ sweepId, amountBrl, slippageBps }) {
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const calculation = calculateProfitStbtcSweep({
      distributableProfitBrl: Number(amountBrl),
      referenceStbtcBrl: SANDBOX_BTC_BRL,
      slippageBps,
    });
    return {
      externalId: sandboxId("profit-quote", sweepId),
      status: "active",
      payload: {
        amountBrl,
        referenceAssetBrl: calculation.referenceAssetBrl.toFixed(2),
        estimatedAssetAmount: calculation.estimatedAssetAmount.toFixed(8),
        minimumAssetAmount: calculation.minimumAssetAmount.toFixed(8),
        expiresAt: expiresAt.toISOString(),
        route: calculation.route,
      },
    };
  },
  async execute({
    sweepId,
    quoteExternalId,
    amountBrl,
    estimatedAssetAmount,
    minimumAssetAmount,
  }) {
    if (!quoteExternalId.startsWith("profit-quote-sandbox-"))
      throw new Error("Cotação sandbox desconhecida para este sweep.");
    const transactionId = sandboxId("profit-execution", sweepId);
    return {
      externalId: transactionId,
      status: "settled",
      payload: {
        amountBrl,
        estimatedAssetAmount,
        minimumAssetAmount,
        route: "BRL>BTC>sBTC>stBTC",
        transactionId,
      },
    };
  },
};

export const sandboxSbtcConversionProvider: SbtcConversionProvider = {
  provider: "sandbox_custody",
  network: "sandbox",
  async convertBtcToSbtc({ purchaseId, btcAmount }) {
    return {
      externalId: sandboxId("sbtc-conversion", purchaseId),
      status: "settled",
      payload: { btcAmount, sbtcAmount: btcAmount, route: "BTC>sBTC", network: "sandbox" },
    };
  },
};

export const sandboxYieldProvider: YieldProvider = {
  provider: "sandbox_stacks",
  network: "sandbox",
  async activatePosition({ purchaseId, sbtcAmount }) {
    return {
      externalId: sandboxId("stacks", purchaseId),
      status: "active",
      payload: { btcAmount: sbtcAmount, sbtcAmount, route: "BTC>sBTC>stBTC", network: "sandbox" },
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
