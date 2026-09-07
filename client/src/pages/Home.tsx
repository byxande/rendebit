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
  Link2,
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
import { toast } from "sonner";

type Network = "mainnet" | "testnet";
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
  { address: "SP3K8BC0D9S4V5C7Q2W6Y1P8H0R3M9N7F4T6G2J1", label: "Treasury", source: "preview" },
];

const PREVIEW_ASSETS: Asset[] = [
  { id: "stx", symbol: "STX", name: "Stacks", balance: "8,450.00", rawBalance: 8450, price: 1.83, change: 5.42, icon: "S", tone: "orange" },
  { id: "sbtc", symbol: "sBTC", name: "Bitcoin on Stacks", balance: "0.0814", rawBalance: 0.0814, price: 104820, change: 2.18, icon: "₿", tone: "gold" },
  { id: "alex", symbol: "ALEX", name: "ALEX Token", balance: "24,180.00", rawBalance: 24180, price: 0.071, change: -1.84, icon: "A", tone: "purple", contract: "alexgo::alex" },
  { id: "usda", symbol: "USDA", name: "Arkadiko USDA", balance: "1,248.32", rawBalance: 1248.32, price: 1, change: 0.02, icon: "$", tone: "blue", contract: "arkadiko-token::usda-token" },
  { id: "ordi", symbol: "ORDI", name: "Ordinance", balance: "42.00", rawBalance: 42, price: 31.4, change: 3.21, icon: "O", tone: "green", contract: "ordi-token::ordi" },
];

const graphBars = [36, 49, 42, 64, 55, 72, 68, 81, 73, 91, 83, 96, 92, 100, 95, 108, 101, 116, 108, 123, 116, 129, 122, 140];

const STSTX_CONTRACT = "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token";
const STSTX_DATA_CONTRACT = "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.data-stx-v2";
const ZEST_RECEIPT_CONTRACT = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststx-token";
const STSTX_LP_CONTRACT = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-stx-ststx-v-1-4";
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
  const tokenContracts = Array.from(new Set(fungibleTokens.map(([assetIdentifier]) => assetIdentifier.split("::")[0]))).slice(0, 11);
  const metadataByContract = new Map<string, TokenMetadata>();

  if (tokenContracts.length) {
    const metadataUrl = new URL(`${API_BY_NETWORK[network]}/metadata/v1/search`);
    tokenContracts.forEach((contract) => metadataUrl.searchParams.append("contract", contract));
    const metadataResponse = await fetch(metadataUrl);
    if (metadataResponse.ok) {
      const metadata = (await metadataResponse.json()) as TokenMetadata[];
      metadata.forEach((token) => metadataByContract.set(token.contract_id, token));
    }
  }

  const assets: Asset[] = [
    {
      id: "stx",
      symbol: "STX",
      name: "Stacks",
      balance: formatTokenBalance(stxBalance),
      rawBalance: stxBalance,
      price: 1.83,
      change: null,
      icon: "S",
      tone: "orange",
    },
    ...fungibleTokens.slice(0, 11).map(([contract, item]) => {
      const contractPrincipal = contract.split("::")[0];
      const metadata = metadataByContract.get(contractPrincipal);
      const decimals = metadata?.decimals ?? 0;
      const symbol = metadata?.symbol || tokenSymbolFromContract(contract);
      const rawAmount = item?.balance || "0";
      const rawBalance = Number(rawAmount) / 10 ** decimals;
      return {
        id: contract,
        symbol,
        name: metadata?.name || contractPrincipal.replaceAll("-", " "),
        balance: formatRawTokenBalance(rawAmount, decimals),
        rawBalance,
        price: null,
        change: null,
        icon: symbol.slice(0, 1),
        tone: tokenTone(symbol),
        contract,
      };
    }),
  ];
  return assets.filter((asset) => asset.rawBalance > 0);
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
  const [assets, setAssets] = useState<Asset[]>(PREVIEW_ASSETS);
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

  const visibleAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => asset.symbol.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query));
  }, [assets, search]);

  const totalEstimatedValue = useMemo(
    () => assets.reduce((total, asset) => total + (asset.price || 0) * asset.rawBalance, 0),
    [assets],
  );
  const allocationTotal = assets.reduce((total, asset) => total + asset.rawBalance * (asset.price || 0), 0) || 1;
  const topAssets = assets.slice(0, 4).map((asset) => ({ ...asset, share: ((asset.rawBalance * (asset.price || 0)) / allocationTotal) * 100 }));

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
    }
    // Wallet state should only be checked once when the app boots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <header className="topbar">
        <div className="topbar__brand">
          <div className="brand-mark"><StacksMark /></div>
          <div>
            <div className="brand-name">STACKFOLIO</div>
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
              <div className="balance-card__topline"><span className="card-label">TOTAL TRACKED VALUE</span><span className="live-tag"><span /> {isPreview ? "PREVIEW" : "LIVE"}</span></div>
              <div className="balance-amount">{isPrivacyMode ? "••••••" : `$${formatNumber(totalEstimatedValue, 2)}`}<span>USD</span></div>
              <div className="balance-change"><span className="change-positive"><ArrowUpRight size={15} /> +8.24%</span><span className="muted-text">vs. last 30 days</span></div>
              <div className="balance-card__bottom"><div><span>NETWORK</span><strong><span className="network-mini-dot" /> STX {network}</strong></div><div><span>ASSETS</span><strong>{assets.length || "—"}</strong></div><div><span>WALLETS</span><strong>{wallets.length}</strong></div></div>
            </div>
            <div className="performance-card card-surface">
              <div className="section-heading"><div><span className="card-label">PERFORMANCE</span><h2>30 day activity</h2></div><div className="range-selector"><span className="range-selector--active">30D</span><span>90D</span><span>1Y</span></div></div>
              <div className="performance-stat"><strong>+8.24%</strong><span>portfolio growth</span></div>
              <div className="chart-wrap"><div className="chart-y"><span>$14k</span><span>$10k</span><span>$6k</span><span>$2k</span></div><div className="bar-chart">{graphBars.map((height, index) => <span key={index} style={{ height: `${height}px`, animationDelay: `${index * 18}ms` }} className={index > 16 ? "bar-chart__bar bar-chart__bar--active" : "bar-chart__bar"} />)}</div><div className="chart-x"><span>Aug 08</span><span>Aug 23</span><span>Sep 07</span></div></div>
            </div>
          </section>

          <section className="middle-grid">
            <div className="assets-card card-surface">
              <div className="section-heading section-heading--table"><div><span className="card-label">YOUR ASSETS</span><h2>Token holdings <span>{assets.length}</span></h2></div><div className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets" /></div></div>
              <div className="asset-table-wrap"><table className="asset-table"><thead><tr><th>ASSET</th><th>BALANCE</th><th>EST. VALUE</th><th>30D</th><th /></tr></thead><tbody>{visibleAssets.map((asset) => <tr key={asset.id}><td><div className="asset-cell"><AssetIcon asset={asset} /><div><strong>{asset.symbol}</strong><span>{asset.name}</span></div></div></td><td><strong>{isPrivacyMode ? "••••" : asset.balance}</strong><span className="asset-unit"> {asset.symbol}</span></td><td>{asset.price ? <><strong>{isPrivacyMode ? "••••" : `$${formatNumber(asset.rawBalance * asset.price)}`}</strong><span className="asset-unit"> USD</span></> : <span className="muted-text">Not priced</span>}</td><td>{asset.change === null ? <span className="muted-text">—</span> : <span className={asset.change >= 0 ? "change-positive" : "change-negative"}>{asset.change >= 0 ? "+" : ""}{asset.change.toFixed(2)}%</span>}</td><td><button className="row-arrow" onClick={() => asset.contract && toast.info(`${asset.contract} is a SIP-010 token.`)} aria-label={`View ${asset.symbol}`}><ArrowUpRight size={15} /></button></td></tr>)}{visibleAssets.length === 0 && <tr><td colSpan={5}><div className="empty-state"><Search size={20} /><strong>No assets found</strong><span>Try a different search.</span></div></td></tr>}</tbody></table></div>
              <div className="table-footer"><span>Showing {visibleAssets.length} of {assets.length} assets</span><button onClick={() => toast.info("Token metadata explorer is coming next.")}>View all tokens <ArrowUpRight size={14} /></button></div>
            </div>
            <div className="allocation-card card-surface"><div className="section-heading"><div><span className="card-label">ALLOCATION</span><h2>By asset</h2></div><button className="more-button" aria-label="Allocation help" onClick={() => toast.info("Allocation uses estimated USD value where available.")}><CircleHelp size={16} /></button></div><div className="allocation-visual"><div className="donut" style={{ background: `conic-gradient(#ff8a3d 0 61%, #e3ba5d 61% 79%, #a78bfa 79% 91%, #69a7ff 91% 96%, #89dd93 96% 100%)` }}><div className="donut__inner"><strong>{assets.length}</strong><span>assets</span></div></div><div className="allocation-list">{topAssets.map((asset) => <div className="allocation-row" key={asset.id}><div><span className={`allocation-dot allocation-dot--${asset.tone}`} />{asset.symbol}</div><strong>{asset.price ? `${asset.share.toFixed(1)}%` : "—"}</strong></div>)}</div></div><div className="allocation-note"><span><Sparkles size={14} /> Diversified across {wallets.length} wallets</span><ArrowUpRight size={14} /></div></div>
          </section>

          <section className="wallets-section"><div className="section-heading section-heading--wallets"><div><span className="card-label">CONNECTED SOURCES</span><h2>Wallets <span>{wallets.length}</span></h2></div><button className="text-button" onClick={() => setIsAddOpen(true)}>Manage wallets <ArrowUpRight size={14} /></button></div><div className="wallet-grid">{wallets.slice(0, 3).map((wallet, index) => <div className={`wallet-card ${wallet.address === activeAddress ? "wallet-card--active" : ""}`} key={wallet.address}><div className="wallet-card__top"><span className="wallet-badge"><Wallet size={16} /></span><span className="wallet-source">{wallet.source === "preview" ? "SAMPLE" : wallet.source === "connected" ? "CONNECTED" : "WATCH ONLY"}</span><button onClick={() => viewExplorer(wallet.address)} aria-label="Open explorer"><ExternalLink size={15} /></button></div><div className="wallet-card__name">{wallet.label}</div><button className="wallet-card__address" onClick={() => { setActiveAddress(wallet.address); void loadAddress(wallet.address, { source: wallet.source, label: wallet.label }); }}><span>{compactAddress(wallet.address)}</span><Copy size={13} /></button><div className="wallet-card__bottom"><span>{wallet.address === activeAddress ? <><span className="wallet-active-dot" /> Active wallet</> : "Stacks address"}</span><span className="wallet-network">{network === "mainnet" ? "MAINNET" : "TESTNET"}</span></div></div>)}<button className="add-wallet-card" onClick={() => setIsAddOpen(true)}><span><Plus size={20} /></span><strong>Add a wallet</strong><small>Connect or track an address</small></button></div></section>

          <footer className="main-footer"><span>Stackfolio <span className="footer-divider">/</span> Built for Stacks</span><span className="footer-links"><a href="https://docs.stacks.co" target="_blank" rel="noreferrer">Docs <ExternalLink size={12} /></a><a href="https://explorer.hiro.so" target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} /></a><span><Link2 size={13} /> Public API</span></span></footer>
          </>
          ) : (
            <StstxTracker address={activeAddress} network={network} />
          )}
        </main>
      </div>

      {isAddOpen && <div className="modal-backdrop" onClick={() => setIsAddOpen(false)}><div className="wallet-modal" onClick={(event) => event.stopPropagation()}><div className="wallet-modal__header"><div><span className="card-label">ADD SOURCE</span><h2>Track a wallet</h2><p>Connect a wallet or watch any Stacks address.</p></div><button className="icon-button" onClick={() => setIsAddOpen(false)} aria-label="Close"><X size={17} /></button></div><button className="modal-connect" onClick={() => void handleConnect()} disabled={isConnecting}><span className="modal-connect__icon"><Wallet size={18} /></span><span><strong>{isConnecting ? "Connecting…" : "Connect a wallet"}</strong><small>Use Leather, Xverse or another Stacks wallet</small></span><ArrowUpRight size={16} /></button><div className="modal-divider"><span>OR</span></div><label className="modal-label">WATCH-ONLY ADDRESS<input value={watchAddress} onChange={(event) => setWatchAddress(event.target.value)} placeholder="SP… or ST…" autoFocus /></label><button className="modal-submit" onClick={addWatchWallet}><Plus size={16} /> Add address</button><div className="modal-note"><ShieldCheck size={14} /> Watch-only mode never requests signing permissions.</div></div></div>}
    </div>
  );
}

export { disconnect };
