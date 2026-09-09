import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  Coins,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { connect, disconnect, getLocalStorage, isConnected } from "@stacks/connect";
import { cvToJSON, deserializeCV } from "@stacks/transactions";
import { toast } from "sonner";
import RendeBitFooter from "@/components/RendeBitFooter";

type Network = "mainnet" | "testnet";
type HistoricalPriceKey = "stx" | "btc" | "alex" | "ststx" | "stable";
type HistoryPart = { key: HistoricalPriceKey; units: number; fallbackPrice?: number };
type Asset = {
  id: string;
  symbol: string;
  name: string;
  balance: string;
  rawBalance: number;
  price: number | null;
  change: number | null;
  icon: string;
  tone: string;
  contract?: string;
  priceSource?: string;
  historyParts?: HistoryPart[];
};

type WalletRecord = {
  address: string;
  label: string;
  source: "connected" | "watch-only" | "preview";
};

type TokenMetadata = {
  contract_id: string;
  name?: string;
  symbol?: string;
  decimals?: number;
};

const API_BY_NETWORK: Record<Network, string> = {
  mainnet: "https://api.hiro.so",
  testnet: "https://api.testnet.hiro.so",
};

const EXPLORER_BY_NETWORK: Record<Network, string> = {
  mainnet: "https://explorer.hiro.so/address",
  testnet: "https://explorer.hiro.so/address",
};

const PREVIEW_WALLETS: WalletRecord[] = [
  { address: "SP7CD8EB3GT9N5PFW8TPY9CMF84208V7KB0EPAPR", label: "My wallet", source: "watch-only" },
];

const STSTX_CONTRACT = "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token";
const STSTX_DATA_CONTRACT = "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.data-stx-v2";
const ZEST_RECEIPT_CONTRACT = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststx-token";
const STSTX_LP_CONTRACT = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-stx-ststx-v-1-4";
const ZEST_STSTX_VAULT = "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-ststx";
const VLIALEX_CONTRACT = "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.auto-alex-v3-wrapped";
const STX_STSTX_POOL = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-stx-ststx-v-1-4";
const STX_AEUSDC_POOL = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-1";
const STX_AEUSDC_CONTRACT = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-1";
const HISTORY_DAYS = [30, 25, 20, 15, 10, 5, 0];

type StstxActivity = {
  txid: string;
  label: string;
  detail: string;
  amount: string;
  date: string;
  tone: "green" | "orange" | "blue";
};

type RateHistoryPoint = {
  date: string;
  label: string;
  ratio: number;
};

type StstxTrackerData = {
  directBalance: number;
  zestBalance: number;
  lpBalance: number;
  ratio: number;
  supply: number;
  stxPrice: number;
  stxChange24h: number;
  apy: number;
  rateHistory: RateHistoryPoint[];
  activities: StstxActivity[];
  unsupported?: boolean;
};

const EMPTY_STSTX_DATA: StstxTrackerData = {
  directBalance: 0,
  zestBalance: 0,
  lpBalance: 0,
  ratio: 0,
  supply: 0,
  stxPrice: 0,
  stxChange24h: 0,
  apy: 0,
  rateHistory: [],
  activities: [],
};

function parseUintRepr(repr?: string) {
  const match = repr?.match(/u(\d+)/);
  return match ? Number(match[1]) / 1_000_000 : 0;
}

function formatActivityDate(date?: string) {
  if (!date) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function parseClarityUint(hex?: string) {
  if (!hex) return 0;
  try {
    return Number(BigInt(`0x${hex.slice(4)}`)) / 1_000_000;
  } catch {
    return 0;
  }
}

async function fetchSafe(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
}

async function fetchMarketPrices() {
  const cacheKey = "rendebit:market-prices";
  let cachedPrices: Record<string, { usd?: number; usd_24h_change?: number }> = {};
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null") as { savedAt?: number; prices?: Record<string, { usd?: number; usd_24h_change?: number }> } | null;
    if (cached?.prices && Date.now() - Number(cached.savedAt || 0) < 21_600_000) cachedPrices = cached.prices;
  } catch {
    // Storage is optional.
  }
  const response = await fetchSafe("https://api.coingecko.com/api/v3/simple/price?ids=blockstack,bitcoin,alexgo,stacking-dao,allbridge-bridged-usdc-stacks&vs_currencies=usd&include_24hr_change=true");
  let prices = { ...cachedPrices, ...(response?.ok ? await response.json() as Record<string, { usd?: number; usd_24h_change?: number }> : {}) };
  if (!prices.blockstack?.usd) {
    const fallback = await fetchSafe("https://api.coinpaprika.com/v1/tickers/stx-stacks");
    if (fallback?.ok) {
      const payload = await fallback.json();
      const quote = payload?.quotes?.USD;
      if (quote?.price) prices = { ...prices, blockstack: { usd: Number(quote.price), usd_24h_change: Number(quote.percent_change_24h || 0) } };
    }
  }
  try {
    if (Object.keys(prices).length) localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), prices }));
    if (Object.keys(prices).length) return prices;
    if (Object.keys(cachedPrices).length) return cachedPrices;
  } catch {
    // Storage is optional; live data remains the source of truth.
  }
  return {} as Record<string, { usd?: number; usd_24h_change?: number }>;
}

type PriceQuote = { usd: number; source: string; historyParts?: HistoryPart[] };

function toClarityUint(value: number) {
  return `0x01${BigInt(Math.max(0, Math.round(value))).toString(16).padStart(32, "0")}`;
}

function decodeClarityResult(result?: string): unknown {
  if (!result) return null;
  try {
    const hex = result.replace(/^0x/, "");
    const bytes = new Uint8Array((hex.match(/.{1,2}/g) || []).map((byte) => Number.parseInt(byte, 16)));
    const decoded = cvToJSON(deserializeCV(bytes)) as { value?: { value?: unknown } | unknown };
    const responseValue = decoded?.value;
    return responseValue && typeof responseValue === "object" && "value" in responseValue
      ? (responseValue as { value?: unknown }).value
      : responseValue ?? null;
  } catch {
    return null;
  }
}

async function callReadOnly(contract: string, functionName: string, args: string[] = []) {
  const separator = contract.indexOf(".");
  if (separator < 1) return null;
  const address = contract.slice(0, separator);
  const name = contract.slice(separator + 1);
  const response = await fetchSafe(`${API_BY_NETWORK.mainnet}/v2/contracts/call-read/${address}/${name}/${functionName}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sender: "SP000000000000000000002Q6VF78", arguments: args }),
  });
  if (!response?.ok) return null;
  const payload = await response.json();
  return payload?.okay ? decodeClarityResult(payload.result) : null;
}

async function fetchPoolReserveFallback(poolContract: string, tokenContract: string) {
  const response = await fetchSafe(`${API_BY_NETWORK.mainnet}/extended/v1/address/${poolContract}/balances?proof=0`);
  if (!response?.ok) return null;
  const data = await response.json();
  const tokenEntry = Object.entries(data?.fungible_tokens || {}).find(([asset]) => asset.startsWith(`${tokenContract}::`)) as [string, { balance?: string }] | undefined;
  const totalSharesRaw = await callReadOnly(poolContract, "get-total-supply");
  const totalShares = clarityNumber(totalSharesRaw) / 1_000_000;
  return { x: Number(data?.stx?.balance || 0) / 1_000_000, y: Number(tokenEntry?.[1]?.balance || 0) / 1_000_000, shares: totalShares };
}

function clarityNumber(value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  if (value && typeof value === "object" && "value" in value) return clarityNumber((value as { value?: unknown }).value);
  return 0;
}

function clarityTuple(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function fetchDefiQuotes(marketPrices: Record<string, { usd?: number; usd_24h_change?: number }>) {
  const stxUsd = Number(marketPrices.blockstack?.usd || 0);
  const bitcoinUsd = Number(marketPrices.bitcoin?.usd || 0);
  const alexUsd = Number(marketPrices.alexgo?.usd || 0);
  const stableUsd = 1;
  const ststxRatio = clarityNumber(await callReadOnly(STSTX_DATA_CONTRACT, "get-stx-per-ststx")) / 1_000_000;
  const ststxUsd = ststxRatio * stxUsd;
  const [zestAssetsRaw, zestSupplyRaw, vliAlexRaw, ststxPoolRaw, aeusdcPoolRaw, ststxReserveFallback, aeusdcReserveFallback] = await Promise.all([
    callReadOnly(ZEST_STSTX_VAULT, "get-total-assets"),
    callReadOnly(ZEST_STSTX_VAULT, "get-total-supply"),
    callReadOnly(VLIALEX_CONTRACT, "get-shares-to-tokens", [toClarityUint(100_000_000)]),
    callReadOnly(STX_STSTX_POOL, "get-pool"),
    callReadOnly(STX_AEUSDC_POOL, "get-pool"),
    fetchPoolReserveFallback(STX_STSTX_POOL, STSTX_CONTRACT),
    fetchPoolReserveFallback(STX_AEUSDC_POOL, "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc"),
  ]);
  const zestAssets = clarityNumber(zestAssetsRaw) / 1_000_000;
  const zestSupply = clarityNumber(zestSupplyRaw) / 1_000_000;
  const zststxUnderlying = zestSupply ? zestAssets / zestSupply : 0;
  const vliAlexUnderlying = clarityNumber(vliAlexRaw) / 100_000_000;
  const ststxPool = clarityTuple(ststxPoolRaw);
  const aeusdcPool = clarityTuple(aeusdcPoolRaw);
  const ststxShares = clarityNumber(ststxPool["total-shares"]) / 1_000_000 || Number(ststxReserveFallback?.shares || 0);
  const ststxX = clarityNumber(ststxPool["x-balance"]) / 1_000_000 || Number(ststxReserveFallback?.x || 0);
  const ststxY = clarityNumber(ststxPool["y-balance"]) / 1_000_000 || Number(ststxReserveFallback?.y || 0);
  const aeusdcShares = clarityNumber(aeusdcPool["total-shares"]) / 1_000_000 || Number(aeusdcReserveFallback?.shares || 0);
  const aeusdcX = clarityNumber(aeusdcPool["x-balance"]) / 1_000_000 || Number(aeusdcReserveFallback?.x || 0);
  const aeusdcY = clarityNumber(aeusdcPool["y-balance"]) / 1_000_000 || Number(aeusdcReserveFallback?.y || 0);
  const ststxLpPrice = ststxShares ? ((ststxX * stxUsd) + (ststxY * ststxUsd)) / ststxShares : 0;
  const aeusdcLpPrice = aeusdcShares ? ((aeusdcX * stxUsd) + (aeusdcY * stableUsd)) / aeusdcShares : 0;
  return {
    ststx: ststxUsd ? { usd: ststxUsd, source: "On-chain ratio", historyParts: [{ key: "stx" as const, units: ststxRatio, fallbackPrice: stxUsd }] } : undefined,
    zststx: ststxUsd && zststxUnderlying ? { usd: ststxUsd * zststxUnderlying, source: "Zest vault NAV", historyParts: [{ key: "ststx" as const, units: zststxUnderlying, fallbackPrice: ststxUsd }] } : undefined,
    listx: stxUsd ? { usd: stxUsd, source: "LISA 1:1 STX peg", historyParts: [{ key: "stx" as const, units: 1, fallbackPrice: stxUsd }] } : undefined,
    vliAlex: alexUsd && vliAlexUnderlying ? { usd: alexUsd * vliAlexUnderlying, source: "Derived from ALEX ratio", historyParts: [{ key: "alex" as const, units: vliAlexUnderlying, fallbackPrice: alexUsd }] } : undefined,
    ststxLp: ststxLpPrice ? { usd: ststxLpPrice, source: "Bitflow reserve NAV", historyParts: [{ key: "stx" as const, units: ststxShares ? ststxX / ststxShares : 0, fallbackPrice: stxUsd }, { key: "ststx" as const, units: ststxShares ? ststxY / ststxShares : 0, fallbackPrice: ststxUsd }] } : undefined,
    aeusdcLp: aeusdcLpPrice ? { usd: aeusdcLpPrice, source: "Bitflow reserve NAV", historyParts: [{ key: "stx" as const, units: aeusdcShares ? aeusdcX / aeusdcShares : 0, fallbackPrice: stxUsd }, { key: "stable" as const, units: aeusdcShares ? aeusdcY / aeusdcShares : 0, fallbackPrice: stableUsd }] } : undefined,
    stx: stxUsd ? { usd: stxUsd, source: "CoinGecko market", historyParts: [{ key: "stx" as const, units: 1, fallbackPrice: stxUsd }] } : undefined,
    btc: bitcoinUsd ? { usd: bitcoinUsd, source: "CoinGecko market", historyParts: [{ key: "btc" as const, units: 1, fallbackPrice: bitcoinUsd }] } : undefined,
    stable: { usd: stableUsd, source: "USD peg", historyParts: [{ key: "stable" as const, units: 1, fallbackPrice: stableUsd }] },
  };
}
type DefiQuotes = Awaited<ReturnType<typeof fetchDefiQuotes>>;

async function fetchHistoricalRates(address: string, network: Network): Promise<RateHistoryPoint[]> {
  if (network !== "mainnet") return [];
  const now = Math.floor(Date.now() / 1_000);
  const blocks = await Promise.all(HISTORY_DAYS.map(async (daysAgo) => {
    const timestamp = now - daysAgo * 86_400;
    const response = await fetchSafe(`${API_BY_NETWORK[network]}/extended/v2/blocks/by-block-time/${timestamp}`);
    if (!response?.ok) return null;
    const block = await response.json();
    return { blockTime: Number(block.block_time) * 1_000, tip: String(block.index_block_hash || "").replace(/^0x/, "") };
  }));

  const points = await Promise.all(blocks.map(async (block) => {
    if (!block?.tip) return null;
    const response = await fetchSafe(`${API_BY_NETWORK[network]}/v2/contracts/call-read/${STSTX_DATA_CONTRACT.replace(".", "/")}/get-stx-per-ststx?tip=${block.tip}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sender: address, arguments: [] }),
    });
    if (!response?.ok) return null;
    const payload = await response.json();
    const ratio = parseClarityUint(payload?.result);
    if (!ratio) return null;
    return {
      date: new Date(block.blockTime).toISOString(),
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(block.blockTime)),
      ratio,
    };
  }));
  return points.filter((point): point is RateHistoryPoint => Boolean(point));
}

async function fetchStstxTracker(address: string, network: Network): Promise<StstxTrackerData> {
  if (network !== "mainnet") return { ...EMPTY_STSTX_DATA, unsupported: true };

  const [balancesResponse, ratioResponse, metadataResponse, transactionsResponse, priceResponse, apyResponse] = await Promise.all([
    fetchSafe(`${API_BY_NETWORK[network]}/extended/v1/address/${address}/balances?proof=0`),
    fetchSafe(`${API_BY_NETWORK[network]}/v2/contracts/call-read/${STSTX_DATA_CONTRACT.replace(".", "/")}/get-stx-per-ststx`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sender: address, arguments: [] }),
    }),
    fetchSafe(`${API_BY_NETWORK[network]}/metadata/v1/ft?symbol=stSTX&limit=20`),
    fetchSafe(`${API_BY_NETWORK[network]}/extended/v1/address/${address}/transactions?limit=50&offset=0`),
    fetchSafe("https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd&include_24hr_change=true"),
    fetchSafe("https://app.stackingdao.com/api/apy?v=2"),
  ]);
  if (!balancesResponse?.ok || !ratioResponse?.ok) throw new Error("The Stacks API did not return stSTX data.");

  const historicalRatesPromise = fetchHistoricalRates(address, network);
  const balances = await balancesResponse.json();
  const ratioPayload = await ratioResponse.json();
  const metadata = metadataResponse?.ok ? await metadataResponse.json() : { results: [] };
  const transactions = transactionsResponse?.ok ? await transactionsResponse.json() : { results: [] };
  const priceData = priceResponse?.ok ? await priceResponse.json() : {};
  const apyData = apyResponse?.ok ? await apyResponse.json() : {};
  const rateHistory = await historicalRatesPromise;
  const fungible = balances.fungible_tokens || {};
  const balanceOf = (contract: string, assetName: string) => Number(fungible[`${contract}::${assetName}`]?.balance || 0) / 1_000_000;
  const ratio = parseClarityUint(ratioPayload?.result);
  const ststxMetadata = (metadata.results || []).find((token: { contract_principal?: string }) => token.contract_principal === STSTX_CONTRACT);
  const supply = Number(ststxMetadata?.total_supply || 0) / 1_000_000;
  const activities = (transactions.results || [])
    .filter((transaction: unknown) => {
      const serialized = JSON.stringify(transaction).toLowerCase();
      return serialized.includes("ststx") || serialized.includes("zststx") || serialized.includes("stx-ststx");
    })
    .slice(0, 8)
    .map((transaction: { tx_id: string; block_time_iso?: string; contract_call?: { function_name?: string; function_args?: Array<{ repr?: string }> } }) => {
      const functionName = transaction.contract_call?.function_name || "on-chain activity";
      const amount = transaction.contract_call?.function_args?.map((arg) => parseUintRepr(arg.repr)).find((value) => value > 0) || 0;
      const isSupply = functionName === "supply";
      const isSwap = functionName.includes("swap");
      return {
        txid: transaction.tx_id,
        label: isSupply ? "Supplied stSTX to Zest" : isSwap ? "Swapped in stSTX pool" : functionName.replaceAll("-", " "),
        detail: `${formatActivityDate(transaction.block_time_iso)} · ${transaction.tx_id.slice(0, 8)}…`,
        amount: amount ? `${formatNumber(amount)} stSTX` : "stSTX position",
        date: transaction.block_time_iso || "",
        tone: isSupply ? "blue" : isSwap ? "orange" : "green",
      };
    });

  return {
    directBalance: balanceOf(STSTX_CONTRACT, "ststx"),
    zestBalance: balanceOf(ZEST_RECEIPT_CONTRACT, "zststx"),
    lpBalance: balanceOf(STSTX_LP_CONTRACT, "pool-token"),
    ratio,
    supply,
    stxPrice: Number(priceData?.blockstack?.usd || 0),
    stxChange24h: Number(priceData?.blockstack?.usd_24h_change || 0),
    apy: Number(apyData?.ststx || 0),
    rateHistory,
    activities,
  };
}

function compactAddress(address: string) {
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

function formatNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function formatTokenBalance(balance: number, decimals = 4) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(balance);
}

function formatRawTokenBalance(rawAmount: string, decimals: number) {
  const normalized = rawAmount.replace(/\D/g, "").replace(/^0+/, "") || "0";
  if (decimals <= 0) return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const padded = normalized.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals).replace(/^0+/, "") || "0";
  const fraction = padded.slice(-decimals).slice(0, 6).replace(/0+$/, "");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
}

function tokenSymbolFromContract(contract: string) {
  if (contract.includes("stableswap-pool-stx-ststx")) return "STX-stSTX LP";
  if (contract.includes("xyk-pool-stx-aeusdc")) return "STX-aeUSDC LP";
  if (contract.includes("xyk-pool-sbtc-dog")) return "sBTC-DOG LP";
  if (contract.includes("xyk-pool-stx-bob")) return "STX-Bob LP";
  const last = contract.split("::").pop() || "TOKEN";
  return last.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tokenTone(symbol: string) {
  const tones = ["purple", "blue", "green", "pink", "gold"];
  return tones[symbol.length % tones.length];
}

function getConnectedAddress() {
  try {
    const stored = getLocalStorage() as { addresses?: { stx?: Array<{ address?: string } | string> } } | null;
    const address = stored?.addresses?.stx?.[0];
    if (typeof address === "string") return address;
    return address?.address || "";
  } catch {
    return "";
  }
}

async function fetchPortfolio(address: string, network: Network) {
  const response = await fetch(`${API_BY_NETWORK[network]}/extended/v1/address/${address}/balances?proof=0`);
  if (!response.ok) throw new Error("Could not load this wallet from the Stacks API.");
  const data = await response.json();
  const stxBalance = Number(data?.stx?.balance || 0) / 1_000_000;
  const fungibleTokens = Object.entries(data?.fungible_tokens || {}) as Array<[string, { balance?: string }] >;
  const nonZeroTokens = fungibleTokens.filter(([, item]) => Number(item?.balance || 0) > 0);
  const preferredTokens = nonZeroTokens.filter(([assetIdentifier]) => /sbtc|ststx|zststx|pool-token/i.test(assetIdentifier));
  const selectedFungibleTokens = [...preferredTokens, ...nonZeroTokens.filter((entry) => !preferredTokens.includes(entry))].slice(0, 14);
  const tokenContracts = Array.from(new Set(selectedFungibleTokens.map(([assetIdentifier]) => assetIdentifier.split("::")[0])));
  const metadataByContract = new Map<string, TokenMetadata>();

  if (tokenContracts.length) {
    const metadataUrl = new URL(`${API_BY_NETWORK[network]}/metadata/v1/search`);
    tokenContracts.forEach((contract) => metadataUrl.searchParams.append("contract", contract));
    const metadataResponse = await fetch(metadataUrl);
    if (metadataResponse.ok) {
      const metadataPayload = (await metadataResponse.json()) as TokenMetadata[] | { results?: TokenMetadata[] };
      const metadata = Array.isArray(metadataPayload) ? metadataPayload : metadataPayload.results || [];
      metadata.forEach((token) => metadataByContract.set(token.contract_id, token));
    }
  }

  const marketPrices = await fetchMarketPrices();
  const defiQuotes: Partial<DefiQuotes> = network === "mainnet" ? await fetchDefiQuotes(marketPrices) : {};
  const priceForSymbol = (symbol: string, contract = "") => {
    const normalized = symbol.toLowerCase();
    if (normalized === "stx") return defiQuotes.stx;
    if (normalized === "sbtc" || normalized === "btc") return marketPrices.bitcoin ? { usd: marketPrices.bitcoin.usd || 0, source: "CoinGecko market", historyParts: [{ key: "btc" as const, units: 1, fallbackPrice: marketPrices.bitcoin.usd || 0 }] } : undefined;
    if (normalized === "ststx") return defiQuotes.ststx;
    if (normalized === "zststx" || contract === ZEST_RECEIPT_CONTRACT) return defiQuotes.zststx;
    if (normalized === "listx" || normalized === "lqstx") return defiQuotes.listx;
    if (normalized === "vli alex" || normalized === "vlialex" || contract === VLIALEX_CONTRACT) return defiQuotes.vliAlex;
    if (normalized === "aeusdc" || normalized === "usdc" || normalized === "usda" || normalized === "usdh" || normalized === "susdh" || normalized === "zaeusdc") return defiQuotes.stable;
    if (contract === STX_STSTX_POOL) return defiQuotes.ststxLp;
    if (contract === STX_AEUSDC_POOL || contract === STX_AEUSDC_CONTRACT) return defiQuotes.aeusdcLp;
    return undefined;
  };
  const stxQuote = priceForSymbol("STX");

  const assets: Asset[] = [
    {
      id: "stx",
      symbol: "STX",
      name: "Stacks",
      balance: formatTokenBalance(stxBalance),
      rawBalance: stxBalance,
      price: stxQuote?.usd ?? null,
      change: marketPrices.blockstack?.usd_24h_change ?? null,
      icon: "S",
      tone: "orange",
      priceSource: stxQuote?.source,
      historyParts: stxQuote?.historyParts?.map((part) => ({ ...part, units: part.units * stxBalance })),
    },
    ...selectedFungibleTokens.map(([contract, item]) => {
      const contractPrincipal = contract.split("::")[0];
      const metadata = metadataByContract.get(contractPrincipal);
      const decimals = metadata?.decimals ?? 0;
      const derivedSymbol = tokenSymbolFromContract(contract);
      const symbol = derivedSymbol.endsWith(" LP") ? derivedSymbol : metadata?.symbol || derivedSymbol;
      const rawAmount = item?.balance || "0";
      const rawBalance = Number(rawAmount) / 10 ** decimals;
      const marketPrice = priceForSymbol(symbol, contractPrincipal);
      return {
        id: contract,
        symbol,
        name: metadata?.name || contractPrincipal.replaceAll("-", " "),
        balance: formatRawTokenBalance(rawAmount, decimals),
        rawBalance,
        price: marketPrice?.usd ?? null,
        change: symbol.toLowerCase() === "stx" ? marketPrices.blockstack?.usd_24h_change ?? null : symbol.toLowerCase() === "sbtc" ? marketPrices.bitcoin?.usd_24h_change ?? null : null,
        icon: symbol.slice(0, 1),
        tone: tokenTone(symbol),
        contract,
        priceSource: marketPrice?.source,
        historyParts: marketPrice?.historyParts?.map((part) => ({ ...part, units: part.units * rawBalance })),
      };
    }),
  ];
  return assets.filter((asset) => asset.rawBalance > 0);
}

type WealthHistoryPoint = { date: string; label: string; value: number };
const WEALTH_HISTORY_DAYS = [30, 27, 24, 21, 18, 15, 12, 9, 6, 3, 0];

async function fetchWealthHistory(assets: Asset[], currentValue: number): Promise<WealthHistoryPoint[]> {
  const parts = assets.flatMap((asset) => asset.historyParts || []);
  if (!parts.length) return [];
  const keys = Array.from(new Set(parts.map((part) => part.key)));
  const coinIds: Record<HistoricalPriceKey, string> = { stx: "blockstack", btc: "bitcoin", alex: "alexgo", ststx: "stacking-dao", stable: "" };
  const feeds = new Map<HistoricalPriceKey, Array<[number, number]>>();
  await Promise.all(keys.map(async (key) => {
    if (key === "stable") {
      feeds.set(key, []);
      return;
    }
    const response = await fetchSafe(`https://api.coingecko.com/api/v3/coins/${coinIds[key]}/market_chart?vs_currency=usd&days=32&interval=daily`);
    if (!response?.ok) return;
    const payload = await response.json();
    feeds.set(key, Array.isArray(payload?.prices) ? payload.prices : []);
  }));
  const now = Date.now();
  const rawPoints = WEALTH_HISTORY_DAYS.map((daysAgo) => {
    const timestamp = now - daysAgo * 86_400_000;
    const value = parts.reduce((total, part) => {
      if (part.key === "stable") return total + part.units * (part.fallbackPrice ?? 1);
      const prices = feeds.get(part.key) || [];
      const closest = prices.reduce<[number, number] | null>((current, point) => {
        if (point[0] > timestamp) return current;
        return !current || point[0] > current[0] ? point : current;
      }, null);
      return total + part.units * (closest?.[1] ?? part.fallbackPrice ?? 0);
    }, 0);
    const date = new Date(timestamp);
    return { date: date.toISOString(), label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date), value };
  }).filter((point) => point.value > 0);
  const latestRawValue = rawPoints[rawPoints.length - 1]?.value || 0;
  const reconciliation = latestRawValue > 0 && currentValue > 0 ? currentValue / latestRawValue : 1;
  return rawPoints.map((point) => ({ ...point, value: point.value * reconciliation }));
}

function StacksMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`stacks-mark ${small ? "stacks-mark--small" : ""}`} aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

function AssetIcon({ asset }: { asset: Asset }) {
  return <span className={`asset-icon asset-icon--${asset.tone}`}>{asset.icon}</span>;
}

function StstxTracker({ address, network }: { address: string; network: Network }) {
  const [data, setData] = useState<StstxTrackerData>(EMPTY_STSTX_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAllActivity, setShowAllActivity] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchStstxTracker(address, network)
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "Could not load stSTX data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [address, network, refreshKey]);

  const trackedStstx = data.directBalance + data.zestBalance;
  const backingStx = trackedStstx * data.ratio;
  const backingUsd = backingStx * data.stxPrice;
  const impliedStstxUsd = data.ratio * data.stxPrice;
  const visibleActivity = showAllActivity ? data.activities : data.activities.slice(0, 4);
  const chartMin = data.rateHistory.length ? Math.min(...data.rateHistory.map((point) => point.ratio)) : 0;
  const chartMax = data.rateHistory.length ? Math.max(...data.rateHistory.map((point) => point.ratio)) : 1;
  const chartRange = Math.max(chartMax - chartMin, 0.000001);
  const chartPoints = data.rateHistory.map((point, index) => ({
    ...point,
    x: data.rateHistory.length === 1 ? 300 : 34 + index * (532 / (data.rateHistory.length - 1)),
    y: 166 - ((point.ratio - chartMin) / chartRange) * 126,
  }));
  const chartPolyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const chartArea = chartPoints.length ? `M ${chartPoints[0].x} 166 L ${chartPoints.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${chartPoints[chartPoints.length - 1].x} 166 Z` : "";

  return (
    <div className="ststx-page">
      <div className="page-heading ststx-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> PROTOCOL / STSTX</div>
          <h1>stSTX <em>tracker</em></h1>
          <p>Follow your liquid-staked STX across your wallet and DeFi positions.</p>
        </div>
        <div className="heading-actions">
          <span className="sync-label"><span className="sync-dot" /> {loading ? "Syncing on-chain" : "Live from Hiro API"}</span>
          <button className="icon-button" onClick={() => setRefreshKey((value) => value + 1)} aria-label="Refresh stSTX data"><RefreshCw size={17} className={loading ? "spin" : ""} /></button>
          <a className="primary-button" href="https://app.stackingdao.com" target="_blank" rel="noreferrer">Open StackingDAO <ArrowUpRight size={15} /></a>
        </div>
      </div>

      {data.unsupported && <div className="ststx-alert"><CircleHelp size={16} /><span>stSTX tracking is currently enabled for mainnet. Switch the network selector above to mainnet for live protocol data.</span></div>}
      {error && <div className="ststx-alert ststx-alert--error"><CircleHelp size={16} /><span>{error}</span><button onClick={() => setRefreshKey((value) => value + 1)}>Retry</button></div>}

      <div className="ststx-hero-grid">
        <div className="ststx-hero card-surface">
          <div className="ststx-hero__glow" />
          <div className="ststx-hero__top"><div className="ststx-token-lockup"><span className="ststx-token-mark">s</span><div><span className="card-label">TRACKED EXPOSURE</span><strong>Stacked STX</strong></div></div><span className="ststx-live"><span /> MAINNET</span></div>
          <div className="ststx-main-value">{loading ? "—" : formatNumber(trackedStstx)} <span>stSTX</span></div>
          <div className="ststx-sub-value">≈ {loading ? "—" : formatNumber(backingStx)} STX backing value <span className="ststx-usd-note">≈ {loading || !backingUsd ? "—" : `$${formatNumber(backingUsd)}`} USD</span></div>
          <div className="ststx-hero__stats"><div><span>DIRECT WALLET</span><strong>{loading ? "—" : formatNumber(data.directBalance)}</strong></div><div><span>DEPLOYED IN DEFI</span><strong>{loading ? "—" : formatNumber(data.zestBalance)}</strong></div><div><span>LP TOKENS</span><strong>{loading ? "—" : formatNumber(data.lpBalance)}</strong></div></div>
        </div>
        <div className="ststx-rate card-surface"><div className="section-heading"><div><span className="card-label">ON-CHAIN RATE</span><h2>stSTX / STX</h2></div><span className="rate-live"><span /> READ-ONLY</span></div><div className="rate-value">{loading || !data.ratio ? "—" : data.ratio.toFixed(6)} <span>STX</span></div><div className="rate-usd">≈ {loading || !impliedStstxUsd ? "—" : `$${formatNumber(impliedStstxUsd)}`} per stSTX</div><p>STX backing each 1 stSTX based on the StackingDAO data contract.</p><div className="rate-foot"><div><span>PROTOCOL APY</span><strong>{loading || !data.apy ? "—" : `${data.apy.toFixed(2)}%`}</strong></div><div><span>REWARD MODEL</span><strong>AUTO-COMPOUND</strong></div></div><a href="https://explorer.hiro.so/txid/SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.data-stx-v2?chain=mainnet" target="_blank" rel="noreferrer" className="contract-link">View data contract <ExternalLink size={13} /></a></div>
      </div>

      <div className="ststx-metrics-grid"><div className="metric-card"><span className="metric-card__icon metric-card__icon--green"><ArrowUpRight size={16} /></span><div><span className="card-label">PORTFOLIO VALUE</span><strong>{loading || !backingUsd ? "—" : `$${formatNumber(backingUsd)}`}</strong><small>{loading ? "Reading price" : "STX backing in USD"}</small></div></div><div className="metric-card"><span className="metric-card__icon metric-card__icon--orange"><Sparkles size={16} /></span><div><span className="card-label">IMPLIED STSTX PRICE</span><strong>{loading || !impliedStstxUsd ? "—" : `$${formatNumber(impliedStstxUsd, 4)}`}</strong><small>Based on live ratio</small></div></div><div className="metric-card"><span className="metric-card__icon metric-card__icon--blue"><BarChart3 size={16} /></span><div><span className="card-label">STX SPOT PRICE</span><strong>{loading || !data.stxPrice ? "—" : `$${formatNumber(data.stxPrice)}`}</strong><small className={data.stxChange24h >= 0 ? "change-positive" : "change-negative"}>{loading ? "Price feed" : `${data.stxChange24h >= 0 ? "+" : ""}${data.stxChange24h.toFixed(2)}% / 24h`}</small></div></div><div className="metric-card"><span className="metric-card__icon metric-card__icon--gold"><Coins size={16} /></span><div><span className="card-label">TOTAL SUPPLY</span><strong>{loading ? "—" : `${formatNumber(data.supply)} stSTX`}</strong><small>From token metadata index</small></div></div></div>

      <div className="rate-history-card card-surface"><div className="section-heading"><div><span className="card-label">HISTORICAL RATE</span><h2>stSTX / STX evolution</h2></div><span className="rate-live"><span /> {loading ? "SYNCING" : "ON-CHAIN"}</span></div>{loading ? <div className="ststx-loading rate-chart-loading"><Loader2 size={18} className="spin" /> Loading historical blocks…</div> : data.rateHistory.length === 0 ? <div className="ststx-loading rate-chart-loading">Historical rate points are temporarily unavailable.</div> : <><div className="rate-chart-wrap"><svg viewBox="0 0 600 205" role="img" aria-label="Historical stSTX to STX exchange rate"><defs><linearGradient id="rate-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#caff4a" stopOpacity=".22" /><stop offset="100%" stopColor="#caff4a" stopOpacity="0" /></linearGradient></defs><line x1="34" y1="40" x2="566" y2="40" /><line x1="34" y1="103" x2="566" y2="103" /><line x1="34" y1="166" x2="566" y2="166" /><text x="0" y="44">{chartMax.toFixed(3)}</text><text x="0" y="107">{((chartMax + chartMin) / 2).toFixed(3)}</text><text x="0" y="170">{chartMin.toFixed(3)}</text>{chartArea && <path d={chartArea} fill="url(#rate-area)" />}{chartPolyline && <polyline points={chartPolyline} fill="none" stroke="#caff4a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}{chartPoints.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="4" fill="#111718" stroke="#caff4a" strokeWidth="2" />)}</svg></div><div className="rate-chart-labels">{chartPoints.map((point) => <span key={point.date}>{point.label}</span>)}</div></>}</div>

      <div className="ststx-content-grid"><div className="positions-card card-surface"><div className="section-heading"><div><span className="card-label">POSITION BREAKDOWN</span><h2>Where your stSTX is</h2></div><span className="position-count">{loading ? "—" : "3 sources"}</span></div><div className="position-list"><div className="position-row"><div className="position-row__identity"><span className="position-icon position-icon--wallet"><Wallet size={16} /></span><div><strong>Wallet balance</strong><span>Direct stSTX token balance</span></div></div><div className="position-row__amount"><strong>{loading ? "—" : formatNumber(data.directBalance)}</strong><span>stSTX</span></div><span className="position-status">{data.directBalance > 0 ? "AVAILABLE" : "EMPTY"}</span></div><div className="position-row"><div className="position-row__identity"><span className="position-icon position-icon--blue"><BarChart3 size={16} /></span><div><strong>Zest lending</strong><span>Receipt tokens detected on-chain</span></div></div><div className="position-row__amount"><strong>{loading ? "—" : formatNumber(data.zestBalance)}</strong><span>zstSTX</span></div><span className="position-status position-status--active">DEPLOYED</span></div><div className="position-row"><div className="position-row__identity"><span className="position-icon position-icon--orange"><Sparkles size={16} /></span><div><strong>STX / stSTX liquidity</strong><span>StableSwap LP position</span></div></div><div className="position-row__amount"><strong>{loading ? "—" : formatNumber(data.lpBalance)}</strong><span>LP tokens</span></div><span className="position-status position-status--active">LIQUIDITY</span></div></div><div className="position-note"><CircleHelp size={14} /> LP tokens are shown separately and are not added to the stSTX exposure total.</div></div><div className="protocol-card card-surface"><div className="protocol-card__top"><span className="ststx-token-mark ststx-token-mark--small">s</span><div><span className="card-label">ABOUT STSTX</span><strong>Liquid staking, kept liquid.</strong></div></div><p>stSTX represents staked STX with auto-compounding rewards while remaining usable across the Stacks DeFi ecosystem.</p><div className="protocol-tags"><span>NO LOCK-UP</span><span>STX YIELD</span><span>SIP-010</span></div><a href="https://docs.stackingdao.com/stackingdao/the-stacking-dao-app/ststx-liquid-stx-staking-with-stx-rewards/ststx-basics.md" target="_blank" rel="noreferrer">Read protocol docs <ArrowUpRight size={14} /></a></div></div>

      <div className="activity-card card-surface"><div className="section-heading"><div><span className="card-label">ON-CHAIN HISTORY</span><h2>Recent stSTX activity</h2></div><button className="text-button" onClick={() => setShowAllActivity((value) => !value)}>{showAllActivity ? "Show less" : "View all"} <ArrowUpRight size={14} /></button></div>{loading ? <div className="ststx-loading"><Loader2 size={18} className="spin" /> Reading wallet activity…</div> : data.activities.length === 0 ? <div className="ststx-loading">No recent stSTX-related transactions found for this address.</div> : <div className="activity-list">{visibleActivity.map((activity) => <a className="activity-row" key={activity.txid} href={`https://explorer.hiro.so/txid/${activity.txid}?chain=${network}`} target="_blank" rel="noreferrer"><span className={`activity-icon activity-icon--${activity.tone}`}>{activity.tone === "blue" ? <ArrowDownLeft size={15} /> : activity.tone === "orange" ? <RefreshCw size={15} /> : <Sparkles size={15} />}</span><span className="activity-copy"><strong>{activity.label}</strong><small>{activity.detail}</small></span><span className="activity-amount">{activity.amount}</span><ExternalLink size={14} className="activity-external" /></a>)}</div>}</div>

      <div className="ststx-disclaimer"><ShieldCheck size={14} /><span>Read-only tracker. Data comes from the public Hiro Stacks API and StackingDAO contracts; protocol APY is an indicative maximum, not a guaranteed return.</span></div>
    </div>
  );
}

export default function Home() {
  const [network, setNetwork] = useState<Network>("mainnet");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>(PREVIEW_WALLETS);
  const [activeAddress, setActiveAddress] = useState("SP7CD8EB3GT9N5PFW8TPY9CMF84208V7KB0EPAPR");
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [watchAddress, setWatchAddress] = useState("");
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [activeView, setActiveView] = useState<"overview" | "ststx">("overview");
  const [isPreview, setIsPreview] = useState(true);
  const [wealthHistory, setWealthHistory] = useState<WealthHistoryPoint[]>([]);
  const [isWealthHistoryLoading, setIsWealthHistoryLoading] = useState(false);

  const visibleAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => asset.symbol.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query));
  }, [assets, search]);

  const totalEstimatedValue = useMemo(
    () => assets.reduce((total, asset) => total + (asset.price || 0) * asset.rawBalance, 0),
    [assets],
  );
  const pricedAssets = assets.filter((asset) => asset.price !== null && asset.rawBalance > 0);
  const allocationTotal = pricedAssets.reduce((total, asset) => total + asset.rawBalance * (asset.price || 0), 0) || 1;
  const topAssets = pricedAssets.slice().sort((left, right) => (right.rawBalance * (right.price || 0)) - (left.rawBalance * (left.price || 0))).slice(0, 4).map((asset) => ({ ...asset, share: ((asset.rawBalance * (asset.price || 0)) / allocationTotal) * 100 }));
  const allocationColors = ["#ff8a3d", "#e3ba5d", "#a78bfa", "#69a7ff", "#89dd93"];
  let allocationCursor = 0;
  const allocationGradient = pricedAssets.length ? `conic-gradient(${pricedAssets.map((asset, index) => { const start = allocationCursor; allocationCursor += ((asset.rawBalance * (asset.price || 0)) / allocationTotal) * 100; return `${allocationColors[index % allocationColors.length]} ${start}% ${allocationCursor}%`; }).join(", ")})` : "conic-gradient(#1c2520 0 100%)";
  const wealthChart = useMemo(() => {
    if (!wealthHistory.length) return { points: [], line: "", area: "", min: 0, max: 0, delta: 0 };
    const values = wealthHistory.map((point) => point.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * 0.16, rawMax * 0.02, 0.01);
    const min = Math.max(0, rawMin - padding);
    const max = rawMax + padding;
    const range = max - min || 1;
    const points = wealthHistory.map((point, index) => ({
      ...point,
      x: 34 + (index / Math.max(1, wealthHistory.length - 1)) * 532,
      y: 158 - ((point.value - min) / range) * 120,
    }));
    const line = points.map((point) => `${point.x},${point.y}`).join(" ");
    const area = points.length ? `M ${points[0].x} ${points[0].y} L ${points.slice(1).map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x} 166 L ${points[0].x} 166 Z` : "";
    const delta = values.length > 1 && values[0] ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0;
    return { points, line, area, min, max, delta };
  }, [wealthHistory]);

  async function loadAddress(address: string, options?: { source?: WalletRecord["source"]; label?: string; toastOnSuccess?: boolean }) {
    setIsRefreshing(true);
    try {
      const nextAssets = await fetchPortfolio(address, network);
      setAssets(nextAssets.length ? nextAssets : []);
      setActiveAddress(address);
      setIsPreview(false);
      const nextWallet: WalletRecord = { address, label: options?.label || "Tracked wallet", source: options?.source || "watch-only" };
      setWallets((current) => [nextWallet, ...current.filter((wallet) => wallet.address !== address)]);
      if (options?.toastOnSuccess) toast.success("Wallet connected", { description: "Balances synced from the Stacks API." });
    } catch (error) {
      toast.error("Could not load wallet", { description: error instanceof Error ? error.message : "Please check the address and try again." });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const response = await connect();
      const walletResponse = response as { addresses?: Array<{ address?: string } | string> };
      const address = typeof walletResponse?.addresses?.[0] === "string" ? walletResponse.addresses[0] : walletResponse?.addresses?.[0]?.address;
      const resolvedAddress = address || getConnectedAddress();
      if (!resolvedAddress) throw new Error("The wallet did not return a Stacks address.");
      await loadAddress(resolvedAddress, { source: "connected", label: "Connected wallet", toastOnSuccess: true });
    } catch (error) {
      if (error instanceof Error && !error.message.toLowerCase().includes("reject")) {
        toast.error("Wallet connection failed", { description: error.message });
      }
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleRefresh() {
    if (isPreview) {
      setIsRefreshing(true);
      window.setTimeout(() => setIsRefreshing(false), 450);
      toast.success("Preview data refreshed", { description: "Connect a wallet to load live on-chain balances." });
      return;
    }
    await loadAddress(activeAddress, { source: wallets.find((wallet) => wallet.address === activeAddress)?.source || "watch-only", label: wallets.find((wallet) => wallet.address === activeAddress)?.label });
  }

  function addWatchWallet() {
    const address = watchAddress.trim();
    if (!/^S[PT][A-Z0-9]{38,40}$/.test(address)) {
      toast.error("Invalid Stacks address", { description: "Paste a mainnet (SP…) or testnet (ST…) address." });
      return;
    }
    setIsAddOpen(false);
    setWatchAddress("");
    void loadAddress(address, { source: "watch-only", label: "Watch-only wallet", toastOnSuccess: true });
  }

  function switchNetwork(nextNetwork: Network) {
    setNetwork(nextNetwork);
    if (!isPreview && activeAddress) {
      window.setTimeout(() => void loadAddress(activeAddress, { source: wallets.find((wallet) => wallet.address === activeAddress)?.source || "watch-only", label: wallets.find((wallet) => wallet.address === activeAddress)?.label }), 0);
    }
  }

  function copyAddress(address: string) {
    void navigator.clipboard?.writeText(address);
    toast.success("Address copied");
  }

  function viewExplorer(address = activeAddress) {
    window.open(`${EXPLORER_BY_NETWORK[network]}/${address}?chain=${network}`, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    if (isConnected()) {
      const address = getConnectedAddress();
      if (address) {
        void loadAddress(address, { source: "connected", label: "Connected wallet" });
      }
    } else if (activeAddress) {
      void loadAddress(activeAddress, { source: "watch-only", label: "My wallet" });
    }
    // Wallet state should only be checked once when the app boots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    if (isPreview || !assets.length) {
      setWealthHistory([]);
      setIsWealthHistoryLoading(false);
      return () => { active = false; };
    }
    setIsWealthHistoryLoading(true);
    void fetchWealthHistory(assets, totalEstimatedValue)
      .then((points) => { if (active) setWealthHistory(points); })
      .catch(() => { if (active) setWealthHistory([]); })
      .finally(() => { if (active) setIsWealthHistoryLoading(false); });
    return () => { active = false; };
  }, [assets, isPreview, totalEstimatedValue]);

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <header className="topbar">
        <div className="topbar__brand">
          <div className="brand-mark"><StacksMark /></div>
          <div>
            <div className="brand-name">RENDEBIT PORTFOLIO</div>
            <div className="brand-kicker">ON-CHAIN PORTFOLIO</div>
          </div>
        </div>
        <div className="topbar__actions">
          <div className="network-pill">
            <span className="status-dot" />
            <span>{network === "mainnet" ? "Stacks mainnet" : "Stacks testnet"}</span>
            <ChevronDown size={14} />
            <select aria-label="Select network" value={network} onChange={(event) => switchNetwork(event.target.value as Network)}>
              <option value="mainnet">Stacks mainnet</option>
              <option value="testnet">Stacks testnet</option>
            </select>
          </div>
          <button className="privacy-toggle" onClick={() => setIsPrivacyMode((value) => !value)} aria-label={isPrivacyMode ? "Show values" : "Hide values"}>
            {isPrivacyMode ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          <button className="connect-button" onClick={() => void handleConnect()} disabled={isConnecting}>
            {isConnecting ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />}
            {isConnecting ? "Connecting" : "Connect wallet"}
          </button>
          <button className="mobile-menu" onClick={() => setIsMobileNavOpen((value) => !value)} aria-label="Toggle navigation"><Menu size={20} /></button>
        </div>
      </header>

      <div className="app-layout">
        <aside className={`sidebar ${isMobileNavOpen ? "sidebar--open" : ""}`}>
          <div className="sidebar__mobile-close"><button onClick={() => setIsMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
          <nav className="sidebar-nav" aria-label="Primary navigation">
            <div className="nav-label">WORKSPACE</div>
            <button className="nav-item nav-item--active"><LayoutDashboard size={18} /><span>Overview</span><span className="nav-count">01</span></button>
            <button className="nav-item" onClick={() => setIsAddOpen(true)}><Wallet size={18} /><span>Wallets</span><span className="nav-count">{wallets.length}</span></button>
            <button className={`nav-item ${activeView === "ststx" ? "nav-item--active" : ""}`} onClick={() => { setActiveView("ststx"); setIsMobileNavOpen(false); }}><Coins size={18} /><span>stSTX tracker</span><span className="nav-count nav-count--new">NEW</span></button>
            <button className="nav-item" onClick={() => toast.info("Activity timeline is coming next.")}><BarChart3 size={18} /><span>Activity</span></button>
            <button className="nav-item" onClick={() => toast.info("Settings are coming next.")}><Settings2 size={18} /><span>Settings</span></button>
          </nav>
          <div className="sidebar-spacer" />
          <div className="chain-card">
            <div className="chain-card__top"><span className="live-pulse" /> LIVE NETWORK</div>
            <div className="chain-card__name"><StacksMark small /> Stacks {network}</div>
            <div className="chain-card__meta"><span>API status</span><strong>Operational</strong></div>
            <div className="chain-card__line"><span /><span /></div>
            <div className="chain-card__footer"><span>Hiro API</span><span>~220ms</span></div>
          </div>
          <div className="sidebar-footer"><ShieldCheck size={14} /> Non-custodial by design</div>
        </aside>

        <main className="main-content">
          {activeView === "overview" ? (
          <>
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> PORTFOLIO / {network.toUpperCase()}</div>
              <h1>Portfolio <em>overview</em></h1>
              <p>Track your tokens across the Stacks network.</p>
            </div>
            <div className="heading-actions">
              <span className="sync-label"><span className="sync-dot" /> Updated just now</span>
              <button className="icon-button" onClick={() => void handleRefresh()} aria-label="Refresh portfolio"><RefreshCw size={17} className={isRefreshing ? "spin" : ""} /></button>
              <button className="primary-button" onClick={() => setIsAddOpen(true)}><Plus size={17} /> Add wallet</button>
            </div>
          </div>

          {isPreview && <div className="preview-banner"><div className="preview-banner__icon"><Sparkles size={17} /></div><div><strong>Preview workspace</strong><span>Sample data is shown until you connect a wallet or add a read-only address.</span></div><button onClick={() => void handleConnect()}>Connect now <ArrowUpRight size={15} /></button></div>}

          <section className="top-grid">
            <div className="balance-card card-surface">
              <div className="balance-card__grid" />
              <div className="balance-card__topline"><span className="card-label">TOTAL PRICED VALUE</span><span className="live-tag"><span /> {isPreview ? "PREVIEW" : "LIVE"}</span></div>
              <div className="balance-amount">{isPrivacyMode ? "••••••" : `$${formatNumber(totalEstimatedValue, 2)}`}<span>USD</span></div>
              <div className="balance-change">{isRefreshing ? <span className="sync-label"><Loader2 size={14} className="spin" /> Syncing balances</span> : <span className="change-positive"><Check size={14} /> Live wallet data</span>}<span className="muted-text">from Hiro API</span></div>
              <div className="balance-card__bottom"><div><span>NETWORK</span><strong><span className="network-mini-dot" /> STX {network}</strong></div><div><span>ASSETS</span><strong>{assets.length || "—"}</strong></div><div><span>WALLETS</span><strong>{wallets.length}</strong></div></div>
            </div>
            <div className="performance-card card-surface">
              <div className="section-heading"><div><span className="card-label">LIVE SNAPSHOT</span><h2>Wallet composition</h2></div><span className="live-tag"><span /> ON-CHAIN</span></div>
              <div className="performance-stat"><strong>{assets.length || "—"}</strong><span>assets with balance</span></div>
              <div className="live-composition"><div><span className="live-composition__label">DIRECT STX</span><strong>{isRefreshing ? "—" : `${formatTokenBalance(assets.find((asset) => asset.id === "stx")?.rawBalance || 0)} STX`}</strong></div><div><span className="live-composition__label">DIRECT STSTX</span><strong>{isRefreshing ? "—" : `${formatTokenBalance(assets.find((asset) => asset.symbol.toLowerCase() === "ststx")?.rawBalance || 0)} stSTX`}</strong></div><div><span className="live-composition__label">PRICED VALUE</span><strong>{isRefreshing ? "—" : `$${formatNumber(totalEstimatedValue, 2)}`}</strong></div></div>
              <div className="live-composition__note"><Check size={14} /> Balances synced directly from your watch-only wallet.</div>
            </div>
          </section>

          <section className="wealth-history-card card-surface"><div className="section-heading"><div><span className="card-label">PORTFOLIO HISTORY</span><h2>Estimated wealth evolution</h2></div><span className={`wealth-status ${isWealthHistoryLoading ? "wealth-status--loading" : ""}`}><span /> {isWealthHistoryLoading ? "SYNCING" : wealthHistory.length ? "30D MARK-TO-MARKET" : "WAITING FOR DATA"}</span></div>{isWealthHistoryLoading ? <div className="wealth-chart-loading"><Loader2 size={18} className="spin" /> Loading market history…</div> : wealthHistory.length === 0 ? <div className="wealth-chart-loading">Historical mark-to-market points are temporarily unavailable.</div> : <><div className="wealth-chart-wrap"><svg viewBox="0 0 600 190" role="img" aria-label="Estimated portfolio wealth evolution over the last 30 days"><defs><linearGradient id="wealth-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#caff4a" stopOpacity=".22" /><stop offset="100%" stopColor="#caff4a" stopOpacity="0" /></linearGradient></defs><line x1="34" y1="38" x2="566" y2="38" /><line x1="34" y1="98" x2="566" y2="98" /><line x1="34" y1="166" x2="566" y2="166" /><text x="0" y="42">{isPrivacyMode ? "•••" : `$${formatNumber(wealthChart.max)}`}</text><text x="0" y="102">{isPrivacyMode ? "•••" : `$${formatNumber((wealthChart.max + wealthChart.min) / 2)}`}</text><text x="0" y="170">{isPrivacyMode ? "•••" : `$${formatNumber(wealthChart.min)}`}</text><path d={wealthChart.area} fill="url(#wealth-area)" /><polyline points={wealthChart.line} fill="none" stroke="#caff4a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{wealthChart.points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="4" fill="#111718" stroke="#caff4a" strokeWidth="2" />)}</svg></div><div className="wealth-chart-labels"><span>{wealthChart.points[0]?.label}</span><span>{wealthChart.points[Math.floor(wealthChart.points.length / 2)]?.label}</span><span>{wealthChart.points[wealthChart.points.length - 1]?.label}</span></div></>}<div className="wealth-chart-note"><span><CircleHelp size={14} /> Current token quantities replayed against historical market prices.</span><strong className={wealthChart.delta >= 0 ? "change-positive" : "change-negative"}>{isPrivacyMode ? "••••" : `${wealthChart.delta >= 0 ? "+" : ""}${wealthChart.delta.toFixed(2)}% / 30D`}</strong></div></section>

          <section className="middle-grid">
            <div className="assets-card card-surface">
              <div className="section-heading section-heading--table"><div><span className="card-label">YOUR ASSETS</span><h2>Token holdings <span>{assets.length}</span></h2></div><div className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets" /></div></div>
              <div className="asset-table-wrap"><table className="asset-table"><thead><tr><th>ASSET</th><th>BALANCE</th><th>EST. VALUE</th><th>30D</th><th /></tr></thead><tbody>{visibleAssets.map((asset) => <tr key={asset.id}><td><div className="asset-cell"><AssetIcon asset={asset} /><div><strong>{asset.symbol}</strong><span>{asset.name}</span></div></div></td><td><strong>{isPrivacyMode ? "••••" : asset.balance}</strong><span className="asset-unit"> {asset.symbol}</span></td><td>{asset.price ? <><strong>{isPrivacyMode ? "••••" : `$${formatNumber(asset.rawBalance * asset.price)}`}</strong><span className="asset-unit asset-source"> {asset.priceSource || "Market"}</span></> : <span className="muted-text">Not priced</span>}</td><td>{asset.change === null ? <span className="muted-text">—</span> : <span className={asset.change >= 0 ? "change-positive" : "change-negative"}>{asset.change >= 0 ? "+" : ""}{asset.change.toFixed(2)}%</span>}</td><td><button className="row-arrow" onClick={() => asset.contract && toast.info(`${asset.contract} is a SIP-010 token.`)} aria-label={`View ${asset.symbol}`}><ArrowUpRight size={15} /></button></td></tr>)}{visibleAssets.length === 0 && <tr><td colSpan={5}><div className="empty-state"><Search size={20} /><strong>No assets found</strong><span>Try a different search.</span></div></td></tr>}</tbody></table></div>
              <div className="table-footer"><span>Showing {visibleAssets.length} of {assets.length} assets</span><button onClick={() => toast.info("Token metadata explorer is coming next.")}>View all tokens <ArrowUpRight size={14} /></button></div>
            </div>
            <div className="allocation-card card-surface"><div className="section-heading"><div><span className="card-label">ALLOCATION</span><h2>By priced asset</h2></div><button className="more-button" aria-label="Allocation help" onClick={() => toast.info("Allocation uses estimated USD value where available.")}><CircleHelp size={16} /></button></div><div className="allocation-visual"><div className="donut" style={{ background: allocationGradient }}><div className="donut__inner"><strong>{pricedAssets.length}</strong><span>priced</span></div></div><div className="allocation-list">{topAssets.map((asset) => <div className="allocation-row" key={asset.id}><div><span className={`allocation-dot allocation-dot--${asset.tone}`} />{asset.symbol}</div><strong>{`${asset.share.toFixed(1)}%`}</strong></div>)}</div></div><div className="allocation-note"><span><Sparkles size={14} /> Known prices across {wallets.length} wallet</span><ArrowUpRight size={14} /></div></div>
          </section>

          <section className="wallets-section"><div className="section-heading section-heading--wallets"><div><span className="card-label">CONNECTED SOURCES</span><h2>Wallets <span>{wallets.length}</span></h2></div><button className="text-button" onClick={() => setIsAddOpen(true)}>Manage wallets <ArrowUpRight size={14} /></button></div><div className="wallet-grid">{wallets.slice(0, 3).map((wallet, index) => <div className={`wallet-card ${wallet.address === activeAddress ? "wallet-card--active" : ""}`} key={wallet.address}><div className="wallet-card__top"><span className="wallet-badge"><Wallet size={16} /></span><span className="wallet-source">{wallet.source === "preview" ? "SAMPLE" : wallet.source === "connected" ? "CONNECTED" : "WATCH ONLY"}</span><button onClick={() => viewExplorer(wallet.address)} aria-label="Open explorer"><ExternalLink size={15} /></button></div><div className="wallet-card__name">{wallet.label}</div><button className="wallet-card__address" onClick={() => { setActiveAddress(wallet.address); void loadAddress(wallet.address, { source: wallet.source, label: wallet.label }); }}><span>{compactAddress(wallet.address)}</span><Copy size={13} /></button><div className="wallet-card__bottom"><span>{wallet.address === activeAddress ? <><span className="wallet-active-dot" /> Active wallet</> : "Stacks address"}</span><span className="wallet-network">{network === "mainnet" ? "MAINNET" : "TESTNET"}</span></div></div>)}<button className="add-wallet-card" onClick={() => setIsAddOpen(true)}><span><Plus size={20} /></span><strong>Add a wallet</strong><small>Connect or track an address</small></button></div></section>

          </>
          ) : (
            <StstxTracker address={activeAddress} network={network} />
          )}
          <RendeBitFooter variant="portfolio" />
        </main>
      </div>

      {isAddOpen && <div className="modal-backdrop" onClick={() => setIsAddOpen(false)}><div className="wallet-modal" onClick={(event) => event.stopPropagation()}><div className="wallet-modal__header"><div><span className="card-label">ADD SOURCE</span><h2>Track a wallet</h2><p>Connect a wallet or watch any Stacks address.</p></div><button className="icon-button" onClick={() => setIsAddOpen(false)} aria-label="Close"><X size={17} /></button></div><button className="modal-connect" onClick={() => void handleConnect()} disabled={isConnecting}><span className="modal-connect__icon"><Wallet size={18} /></span><span><strong>{isConnecting ? "Connecting…" : "Connect a wallet"}</strong><small>Use Leather, Xverse or another Stacks wallet</small></span><ArrowUpRight size={16} /></button><div className="modal-divider"><span>OR</span></div><label className="modal-label">WATCH-ONLY ADDRESS<input value={watchAddress} onChange={(event) => setWatchAddress(event.target.value)} placeholder="SP… or ST…" autoFocus /></label><button className="modal-submit" onClick={addWatchWallet}><Plus size={16} /> Add address</button><div className="modal-note"><ShieldCheck size={14} /> Watch-only mode never requests signing permissions.</div></div></div>}
    </div>
  );
}

export { disconnect };
