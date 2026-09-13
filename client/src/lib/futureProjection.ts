export type ProjectionScenario = {
  id: "queda" | "estavel" | "alta";
  label: string;
  btcAnnualChange: number;
};

export type ProjectionPoint = {
  month: number;
  contributedBrl: number;
  protocolYieldBtc: number;
  protocolYieldBrl: number;
  marketEffectBrl: number;
  projectedValueBrl: number;
  projectedBtc: number;
  projectedBtcPriceBrl: number;
};

export const FUTURE_SCENARIOS: ProjectionScenario[] = [
  { id: "queda", label: "BTC em queda", btcAnnualChange: -0.15 },
  { id: "estavel", label: "BTC estável", btcAnnualChange: 0 },
  { id: "alta", label: "BTC em alta", btcAnnualChange: 0.15 },
];

export function projectFuture(input: {
  initialBrl: number;
  monthlyBrl: number;
  years: number;
  protocolAnnualYield?: number;
  btcAnnualChange: number;
  currentBtcBrl: number;
}): ProjectionPoint[] {
  const initialBrl = Math.max(0, input.initialBrl);
  const monthlyBrl = Math.max(0, input.monthlyBrl);
  const years = Math.max(1, Math.min(10, Math.round(input.years)));
  const annualYield = input.protocolAnnualYield ?? 0.03;
  const monthlyYield = Math.pow(1 + annualYield, 1 / 12) - 1;
  const monthlyBtcChange = Math.pow(1 + input.btcAnnualChange, 1 / 12) - 1;
  const currentBtcBrl = Math.max(0.01, input.currentBtcBrl);

  let btcBalance = initialBrl / currentBtcBrl;
  let protocolYieldBtc = 0;
  const points: ProjectionPoint[] = [];

  for (let month = 0; month <= years * 12; month += 1) {
    const btcPrice = currentBtcBrl * Math.pow(1 + monthlyBtcChange, month);
    if (month > 0) {
      const yieldForMonth = btcBalance * monthlyYield;
      btcBalance += yieldForMonth;
      protocolYieldBtc += yieldForMonth;
      btcBalance += monthlyBrl / btcPrice;
    }

    const contributedBrl = initialBrl + monthlyBrl * month;
    const projectedValueBrl = btcBalance * btcPrice;
    const protocolYieldBrl = protocolYieldBtc * btcPrice;
    const marketEffectBrl = projectedValueBrl - contributedBrl - protocolYieldBrl;

    points.push({
      month,
      contributedBrl,
      protocolYieldBtc,
      protocolYieldBrl,
      marketEffectBrl,
      projectedValueBrl,
      projectedBtc: btcBalance,
      projectedBtcPriceBrl: btcPrice,
    });
  }

  return points;
}
