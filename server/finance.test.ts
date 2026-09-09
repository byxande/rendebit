import { describe, expect, it } from "vitest";
import {
  calculateDistributableProfit,
  calculateProfitStbtcSweep,
  calculatePurchaseQuote,
  calculateRedemptionQuote,
  estimateDistributionAsset,
  isValidStacksAddress,
} from "./finance";

describe("calculatePurchaseQuote", () => {
  it("separa taxa, spread e BTC comprado", () => {
    const quote = calculatePurchaseQuote(1_000, 400_000, 65, 50);
    expect(quote.serviceFeeBrl).toBe(5);
    expect(quote.appliedBrl).toBe(995);
    expect(quote.executionBtcBrl).toBe(402_600);
    expect(quote.btcAmount).toBe(0.00247144);
  });

  it("rejeita valores inválidos", () => {
    expect(() => calculatePurchaseQuote(0)).toThrow();
  });
});

describe("calculateRedemptionQuote", () => {
  it("separa valor bruto, custos e valor líquido do Pix", () => {
    const quote = calculateRedemptionQuote(0.01, 400_000, 15, 45);
    expect(quote.grossBrl).toBe(4_000);
    expect(quote.protocolFeeBrl).toBe(6);
    expect(quote.conversionPixFeeBrl).toBe(18);
    expect(quote.netBrl).toBe(3_976);
  });

  it("rejeita quantidade, preço ou taxas inválidas", () => {
    expect(() => calculateRedemptionQuote(0)).toThrow("maior que zero");
    expect(() => calculateRedemptionQuote(0.01, 0)).toThrow("indisponível");
    expect(() => calculateRedemptionQuote(0.01, 400_000, 1_001)).toThrow(
      "fora do intervalo"
    );
  });
});

describe("calculateDistributableProfit", () => {
  it("nunca mistura receita bruta com lucro distribuível", () => {
    const result = calculateDistributableProfit({
      grossRevenueBrl: 1_000,
      providerCostsBrl: 200,
      taxReserveBps: 1_500,
      operationalReserveBps: 1_000,
      distributionShareBps: 10_000,
    });
    expect(result.netBeforeReservesBrl).toBe(800);
    expect(result.taxReserveBrl).toBe(120);
    expect(result.operationalReserveBrl).toBe(80);
    expect(result.distributableProfitBrl).toBe(600);
  });

  it("não distribui valor negativo", () => {
    const result = calculateDistributableProfit({
      grossRevenueBrl: 10,
      providerCostsBrl: 20,
      taxReserveBps: 1_500,
      operationalReserveBps: 1_000,
      distributionShareBps: 10_000,
    });
    expect(result.distributableProfitBrl).toBe(0);
  });
});

describe("Stacks treasury", () => {
  it("diferencia endereços públicos de testnet e mainnet", () => {
    expect(
      isValidStacksAddress("ST000000000000000000002AMW42H", "testnet")
    ).toBe(true);
    expect(
      isValidStacksAddress("SP000000000000000000002Q6VF78", "mainnet")
    ).toBe(true);
    expect(
      isValidStacksAddress("SP000000000000000000002Q6VF78", "testnet")
    ).toBe(false);
  });

  it("estima o ativo somente como referência sandbox", () => {
    expect(estimateDistributionAsset(421_930, "sBTC")).toBe(1);
    expect(estimateDistributionAsset(42, "STX")).toBe(10);
  });

  it("cria um sweep de lucro BRL para stBTC com mínimo protegido por slippage", () => {
    const sweep = calculateProfitStbtcSweep({
      distributableProfitBrl: 1_000,
      referenceStbtcBrl: 400_000,
      slippageBps: 50,
    });
    expect(sweep.sourceAmountBrl).toBe(1_000);
    expect(sweep.estimatedAssetAmount).toBe(0.0025);
    expect(sweep.minimumAssetAmount).toBe(0.0024875);
    expect(sweep.route).toBe("BRL>BTC>sBTC>stBTC");
  });

  it("bloqueia sweep sem lucro ou com slippage fora da política", () => {
    expect(() =>
      calculateProfitStbtcSweep({ distributableProfitBrl: 0 })
    ).toThrow("maior que zero");
    expect(() =>
      calculateProfitStbtcSweep({
        distributableProfitBrl: 10,
        slippageBps: 501,
      })
    ).toThrow("entre 0 e 500");
  });
});
