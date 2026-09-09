import { describe, expect, it } from "vitest";
import { projectFuture } from "../client/src/lib/futureProjection";

describe("projeções futuras", () => {
  it("aplica 3% ao ano à quantidade de Bitcoin em cenário estável", () => {
    const points = projectFuture({ initialBrl: 1_000, monthlyBrl: 0, years: 1, protocolAnnualYield: 0.03, btcAnnualChange: 0, currentBtcBrl: 500_000 });
    expect(points.at(-1)?.projectedValueBrl).toBeCloseTo(1_030, 8);
    expect(points.at(-1)?.protocolYieldBrl).toBeCloseTo(30, 8);
    expect(points.at(-1)?.marketEffectBrl).toBeCloseTo(0, 8);
  });

  it("soma os aportes mensais sem inventar rendimento", () => {
    const points = projectFuture({ initialBrl: 0, monthlyBrl: 100, years: 1, protocolAnnualYield: 0, btcAnnualChange: 0, currentBtcBrl: 500_000 });
    expect(points.at(-1)?.contributedBrl).toBe(1_200);
    expect(points.at(-1)?.projectedValueBrl).toBeCloseTo(1_200, 8);
  });

  it("separa a valorização do BTC do rendimento do protocolo", () => {
    const points = projectFuture({ initialBrl: 1_000, monthlyBrl: 0, years: 1, protocolAnnualYield: 0, btcAnnualChange: 0.1, currentBtcBrl: 500_000 });
    expect(points.at(-1)?.projectedValueBrl).toBeCloseTo(1_100, 8);
    expect(points.at(-1)?.marketEffectBrl).toBeCloseTo(100, 8);
    expect(points.at(-1)?.protocolYieldBrl).toBeCloseTo(0, 8);
  });
});
