import { createHmac } from "node:crypto";
import { ENV } from "../_core/env";
import type { BtcLiquidityProvider } from "./types";

const BINANCE_API = "https://api.binance.com";

type BinanceExchangeInfo = {
  symbols?: Array<{
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    isSpotTradingAllowed?: boolean;
  }>;
};

type BinanceAccount = {
  canTrade?: boolean;
};

type BinanceOrder = {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  status:
    | "NEW"
    | "PARTIALLY_FILLED"
    | "FILLED"
    | "CANCELED"
    | "REJECTED"
    | "EXPIRED";
  executedQty: string;
  cummulativeQuoteQty: string;
  fills?: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
};

function assertRealLiquidityEnabled() {
  if (!ENV.binanceApiKey || !ENV.binanceApiSecret) {
    throw new Error(
      "Binance não configurada. Adicione as credenciais somente nos secrets do backend."
    );
  }
  if (!ENV.realBtcLiquidityEnabled) {
    throw new Error(
      "Liquidez real Binance permanece bloqueada; habilite o gate operacional explicitamente."
    );
  }
}

function encodeParams(params: Record<string, string | number>) {
  return new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );
}

async function binanceRequest<T>(
  path: string,
  params: Record<string, string | number> = {},
  signed = false
) {
  const query = encodeParams(
    signed ? { ...params, timestamp: Date.now(), recvWindow: 5_000 } : params
  );
  if (signed) {
    const signature = createHmac("sha256", ENV.binanceApiSecret)
      .update(query.toString())
      .digest("hex");
    query.set("signature", signature);
  }
  const response = await fetch(`${BINANCE_API}${path}?${query.toString()}`, {
    headers: signed ? { "X-MBX-APIKEY": ENV.binanceApiKey } : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.msg === "string"
        ? payload.msg
        : `HTTP ${response.status}`;
    throw new Error(`Binance recusou a solicitação: ${message}`);
  }
  return payload as T;
}

function safeClientOrderId(purchaseId: number, idempotencyKey: string) {
  const suffix = idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(-20);
  return `rendebit${purchaseId}${suffix}`.slice(0, 36);
}

export const binanceBtcLiquidityConfig = {
  provider: "binance" as const,
  symbol: "BTCBRL" as const,
  configured: Boolean(ENV.binanceApiKey && ENV.binanceApiSecret),
  realExecutionEnabled: ENV.realBtcLiquidityEnabled,
  maxSlippageBps: ENV.binanceMaxSlippageBps,
  role: "Liquidez Spot BTCBRL da organização; não é custodiante de carteira Stacks do cliente." as const,
};

export function createBinanceBtcLiquidityProvider(): BtcLiquidityProvider {
  return {
    provider: "binance",
    mode: "production",
    async preflight({ amountBrl }) {
      assertRealLiquidityEnabled();
      const [market, account] = await Promise.all([
        binanceRequest<BinanceExchangeInfo>("/api/v3/exchangeInfo", {
          symbol: "BTCBRL",
        }),
        binanceRequest<BinanceAccount>("/api/v3/account", {}, true),
      ]);
      const symbol = market.symbols?.find(item => item.symbol === "BTCBRL");
      if (
        !symbol ||
        symbol.status !== "TRADING" ||
        symbol.isSpotTradingAllowed === false
      ) {
        throw new Error(
          "O mercado Spot BTCBRL não está disponível para esta conta/região."
        );
      }
      if (!account.canTrade)
        throw new Error("A chave Binance não possui permissão de trading.");
      if (Number(amountBrl) <= 0)
        throw new Error("O valor BRL da ordem Binance precisa ser positivo.");
    },
    async buyBitcoin({
      purchaseId,
      amountBrl,
      executionBtcBrl,
      idempotencyKey,
    }) {
      assertRealLiquidityEnabled();
      const clientOrderId = safeClientOrderId(purchaseId, idempotencyKey);
      const order = await binanceRequest<BinanceOrder>(
        "/api/v3/order",
        {
          symbol: "BTCBRL",
          side: "BUY",
          type: "MARKET",
          quoteOrderQty: amountBrl,
          newClientOrderId: clientOrderId,
          newOrderRespType: "FULL",
        },
        true
      );
      if (order.status !== "FILLED") {
        throw new Error(
          `A ordem Binance BTCBRL não foi totalmente executada: ${order.status}.`
        );
      }
      const executedBtc = Number(order.executedQty);
      const spentBrl = Number(order.cummulativeQuoteQty);
      const quotedBtcBrl = Number(executionBtcBrl);
      if (
        !Number.isFinite(executedBtc) ||
        !Number.isFinite(spentBrl) ||
        executedBtc <= 0 ||
        spentBrl <= 0
      ) {
        throw new Error("A Binance retornou uma ordem sem execução válida.");
      }
      const actualBtcBrl = spentBrl / executedBtc;
      const maximumBtcBrl =
        quotedBtcBrl * (1 + ENV.binanceMaxSlippageBps / 10_000);
      if (
        !Number.isFinite(quotedBtcBrl) ||
        quotedBtcBrl <= 0 ||
        actualBtcBrl > maximumBtcBrl
      ) {
        throw new Error(
          "A execução Binance ultrapassou o limite de preço aprovado; reconciliação manual obrigatória."
        );
      }
      return {
        externalId: String(order.orderId),
        status: "settled" as const,
        payload: {
          amountBrl: order.cummulativeQuoteQty,
          btcAmount: order.executedQty,
          executionBtcBrl: actualBtcBrl.toFixed(2),
          symbol: "BTCBRL" as const,
          orderId: String(order.orderId),
          status: "filled" as const,
        },
      };
    },
  };
}
