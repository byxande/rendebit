import { describe, expect, it } from "vitest";
import {
  calculateDistributableProfit,
  calculatePurchaseQuote,
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
    expect(isValidStacksAddress("ST000000000000000000002AMW42H", "testnet")).toBe(true);
    expect(isValidStacksAddress("SP000000000000000000002Q6VF78", "mainnet")).toBe(true);
    expect(isValidStacksAddress("SP000000000000000000002Q6VF78", "testnet")).toBe(false);
  });

  it("estima o ativo somente como referência sandbox", () => {
    expect(estimateDistributionAsset(421_930, "sBTC")).toBe(1);
    expect(estimateDistributionAsset(42, "STX")).toBe(10);
  });
});
