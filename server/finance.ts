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

export function calculateRedemptionQuote(
  btcAmount: number,
  referenceBtcBrl = SANDBOX_BTC_BRL,
  protocolFeeBps = 15,
  conversionPixFeeBps = 45,
) {
  if (!Number.isFinite(btcAmount) || btcAmount <= 0) {
    throw new Error("A quantidade do resgate deve ser maior que zero.");
  }
  if (!Number.isFinite(referenceBtcBrl) || referenceBtcBrl <= 0) {
    throw new Error("A cotação BTC/BRL está indisponível.");
  }
  for (const [label, value] of [["Taxa do protocolo", protocolFeeBps], ["Taxa de conversão e Pix", conversionPixFeeBps]] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 1_000) throw new Error(`${label} fora do intervalo permitido.`);
  }

  const normalizedBtcAmount = roundAsset(btcAmount);
  const grossBrl = roundMoney(normalizedBtcAmount * referenceBtcBrl);
  const protocolFeeBrl = roundMoney(grossBrl * (protocolFeeBps / 10_000));
  const conversionPixFeeBrl = roundMoney(grossBrl * (conversionPixFeeBps / 10_000));
  const netBrl = roundMoney(grossBrl - protocolFeeBrl - conversionPixFeeBrl);
  if (netBrl <= 0) throw new Error("O valor líquido do resgate precisa ser maior que zero.");

  return {
    btcAmount: normalizedBtcAmount,
    referenceBtcBrl: roundMoney(referenceBtcBrl),
    grossBrl,
    protocolFeeBps,
    protocolFeeBrl,
    conversionPixFeeBps,
    conversionPixFeeBrl,
    netBrl,
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
