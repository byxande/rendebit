import { c32addressDecode, versions } from "c32check";

export const SANDBOX_BTC_BRL = 421_930;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundAsset = (value: number) => Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000;

export function calculatePurchaseQuote(
  amountBrl: number,
  referenceBtcBrl = SANDBOX_BTC_BRL,
  spreadBps = 65,
  serviceFeeBps = 50,
) {
  if (!Number.isFinite(amountBrl) || amountBrl <= 0) {
    throw new Error("O valor da compra deve ser maior que zero.");
  }

  const executionBtcBrl = roundMoney(referenceBtcBrl * (1 + spreadBps / 10_000));
  const serviceFeeBrl = roundMoney(amountBrl * (serviceFeeBps / 10_000));
  const appliedBrl = roundMoney(amountBrl - serviceFeeBrl);
  const btcAmount = roundAsset(appliedBrl / executionBtcBrl);

  return {
    amountBrl: roundMoney(amountBrl),
    referenceBtcBrl: roundMoney(referenceBtcBrl),
    executionBtcBrl,
    spreadBps,
    serviceFeeBps,
    serviceFeeBrl,
    appliedBrl,
    btcAmount,
  };
}

export function calculateDistributableProfit(input: {
  grossRevenueBrl: number;
  providerCostsBrl: number;
  taxReserveBps: number;
  operationalReserveBps: number;
  distributionShareBps: number;
}) {
  const netBeforeReserves = Math.max(0, input.grossRevenueBrl - input.providerCostsBrl);
  const taxReserveBrl = roundMoney(netBeforeReserves * (input.taxReserveBps / 10_000));
  const operationalReserveBrl = roundMoney(netBeforeReserves * (input.operationalReserveBps / 10_000));
  const afterReserves = Math.max(0, netBeforeReserves - taxReserveBrl - operationalReserveBrl);
  const distributableProfitBrl = roundMoney(afterReserves * (input.distributionShareBps / 10_000));

  return {
    grossRevenueBrl: roundMoney(input.grossRevenueBrl),
    providerCostsBrl: roundMoney(input.providerCostsBrl),
    netBeforeReservesBrl: roundMoney(netBeforeReserves),
    taxReserveBrl,
    operationalReserveBrl,
    distributableProfitBrl,
  };
}

export function isValidStacksAddress(address: string, network: "testnet" | "mainnet") {
  const trimmed = address.trim();
  try {
    const [version] = c32addressDecode(trimmed);
    const accepted = network === "mainnet"
      ? [versions.mainnet.p2pkh, versions.mainnet.p2sh]
      : [versions.testnet.p2pkh, versions.testnet.p2sh];
    return accepted.includes(version);
  } catch {
    return false;
  }
}

export function estimateDistributionAsset(
  amountBrl: number,
  asset: "STX" | "sBTC" | "stBTC",
) {
  const sandboxReferenceBrl = asset === "STX" ? 4.2 : SANDBOX_BTC_BRL;
  return roundAsset(amountBrl / sandboxReferenceBrl);
}
