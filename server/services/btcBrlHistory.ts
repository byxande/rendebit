export const BTC_HISTORY_PERIODS = ["24h", "7d", "30d", "90d", "1y", "10y", "all"] as const;
export type BtcHistoryPeriod = (typeof BTC_HISTORY_PERIODS)[number];

export type BtcBrlHistoryPoint = { timestamp: number; priceBrl: number };
export type BtcBrlHistory = {
  pair: "BTC/BRL";
  period: BtcHistoryPeriod;
  periodLabel: string;
  points: BtcBrlHistoryPoint[];
  startPriceBrl: number;
  endPriceBrl: number;
  changeBrl: number;
  changePercent: number;
  lowPriceBrl: number;
  highPriceBrl: number;
  source: "CoinGecko" | "Yahoo Finance";
  sourceUrl: string;
  fetchedAt: number;
  stale: boolean;
};

type FetchLike = typeof fetch;
type CacheEntry = { data: BtcBrlHistory; fetchedAt: number };

const REQUEST_TIMEOUT_MS = 7_000;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_STALE_MS = 24 * 60 * 60_000;
const MAX_CHART_POINTS = 240;
const cache = new Map<BtcHistoryPeriod, CacheEntry>();

const periodConfig: Record<BtcHistoryPeriod, { label: string; days: string; yahooRange: string; yahooInterval: string; windowMs?: number }> = {
  "24h": { label: "24 horas", days: "1", yahooRange: "1d", yahooInterval: "5m", windowMs: 24 * 60 * 60_000 },
  "7d": { label: "7 dias", days: "7", yahooRange: "1mo", yahooInterval: "30m", windowMs: 7 * 24 * 60 * 60_000 },
  "30d": { label: "30 dias", days: "30", yahooRange: "1mo", yahooInterval: "1h", windowMs: 30 * 24 * 60 * 60_000 },
  "90d": { label: "90 dias", days: "90", yahooRange: "3mo", yahooInterval: "1d", windowMs: 90 * 24 * 60 * 60_000 },
  "1y": { label: "1 ano", days: "365", yahooRange: "1y", yahooInterval: "1d", windowMs: 365 * 24 * 60 * 60_000 },
  "10y": { label: "10 anos", days: "3650", yahooRange: "10y", yahooInterval: "1wk", windowMs: 10 * 365.25 * 24 * 60 * 60_000 },
  all: { label: "Todo o histórico", days: "max", yahooRange: "max", yahooInterval: "1mo" },
};

function roundedPrice(value: unknown) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 100 || price > 20_000_000) return null;
  return Math.round(price * 100) / 100;
}

async function fetchJson(url: string, fetcher: FetchLike) {
  const response = await fetcher(url, {
    headers: { accept: "application/json", "user-agent": "RendeBit/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Fonte histórica respondeu HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

function filterWindow(points: BtcBrlHistoryPoint[], period: BtcHistoryPeriod, now: number) {
  const windowMs = periodConfig[period].windowMs;
  if (!windowMs) return points;
  const minimum = now - windowMs;
  return points.filter(point => point.timestamp >= minimum);
}

export function downsampleBtcHistory(points: BtcBrlHistoryPoint[], maxPoints = MAX_CHART_POINTS) {
  if (points.length <= maxPoints) return points;
  const result: BtcBrlHistoryPoint[] = [points[0]];
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const bucketSize = (points.length - 2) / bucketCount;
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor(bucket * bucketSize);
    const end = Math.min(points.length - 1, 1 + Math.floor((bucket + 1) * bucketSize));
    const slice = points.slice(start, Math.max(start + 1, end));
    const low = slice.reduce((best, point) => point.priceBrl < best.priceBrl ? point : best, slice[0]);
    const high = slice.reduce((best, point) => point.priceBrl > best.priceBrl ? point : best, slice[0]);
    for (const point of [low, high].sort((a, b) => a.timestamp - b.timestamp)) {
      if (result.at(-1)?.timestamp !== point.timestamp) result.push(point);
    }
  }
  const last = points.at(-1)!;
  if (result.at(-1)?.timestamp !== last.timestamp) result.push(last);
  return result.slice(0, maxPoints);
}

function buildHistory(input: {
  period: BtcHistoryPeriod;
  points: BtcBrlHistoryPoint[];
  source: BtcBrlHistory["source"];
  sourceUrl: string;
  now: number;
}): BtcBrlHistory {
  const sorted = input.points
    .filter(point => Number.isFinite(point.timestamp) && roundedPrice(point.priceBrl) !== null)
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((point, index, array) => index === 0 || point.timestamp !== array[index - 1].timestamp);
  const windowed = filterWindow(sorted, input.period, input.now);
  if (windowed.length < 2) throw new Error("Série histórica insuficiente para o período solicitado.");
  const points = downsampleBtcHistory(windowed);
  const startPriceBrl = points[0].priceBrl;
  const endPriceBrl = points.at(-1)!.priceBrl;
  const values = points.map(point => point.priceBrl);
  const changeBrl = endPriceBrl - startPriceBrl;
  return {
    pair: "BTC/BRL",
    period: input.period,
    periodLabel: periodConfig[input.period].label,
    points,
    startPriceBrl: Math.round(startPriceBrl * 100) / 100,
    endPriceBrl: Math.round(endPriceBrl * 100) / 100,
    changeBrl: Math.round(changeBrl * 100) / 100,
    changePercent: Math.round((changeBrl / startPriceBrl) * 10_000) / 100,
    lowPriceBrl: Math.round(Math.min(...values) * 100) / 100,
    highPriceBrl: Math.round(Math.max(...values) * 100) / 100,
    source: input.source,
    sourceUrl: input.sourceUrl,
    fetchedAt: input.now,
    stale: false,
  };
}

export async function fetchCoinGeckoBtcBrlHistory(period: BtcHistoryPeriod, fetcher: FetchLike = fetch, now = Date.now()) {
  const days = periodConfig[period].days;
  const sourceUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=brl&days=${days}&precision=2`;
  const payload = await fetchJson(sourceUrl, fetcher) as { prices?: unknown };
  if (!Array.isArray(payload.prices)) throw new Error("Resposta histórica inesperada do CoinGecko.");
  const points = payload.prices.flatMap(value => {
    if (!Array.isArray(value) || value.length < 2) return [];
    const priceBrl = roundedPrice(value[1]);
    return priceBrl === null ? [] : [{ timestamp: Number(value[0]), priceBrl }];
  });
  return buildHistory({ period, points, source: "CoinGecko", sourceUrl, now });
}

type YahooChart = {
  chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown }; timestamp?: unknown[]; indicators?: { quote?: Array<{ close?: unknown[] }> } }>; error?: unknown };
};

function yahooSeries(payload: YahooChart) {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps.flatMap((timestamp, index) => {
    const price = Number(closes[index]);
    return Number.isFinite(Number(timestamp)) && Number.isFinite(price) ? [{ timestamp: Number(timestamp) * 1_000, price }] : [];
  });
}

function nearestPriorPrice(series: Array<{ timestamp: number; price: number }>, timestamp: number, fallback: number) {
  let match = fallback;
  for (const point of series) {
    if (point.timestamp > timestamp) break;
    match = point.price;
  }
  return match;
}

export async function fetchYahooBtcBrlHistory(period: BtcHistoryPeriod, fetcher: FetchLike = fetch, now = Date.now()) {
  const config = periodConfig[period];
  const btcUrl = `https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?range=${config.yahooRange}&interval=${config.yahooInterval}`;
  const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?range=${config.yahooRange}&interval=${config.yahooInterval}`;
  const btcPayload = await fetchJson(btcUrl, fetcher) as YahooChart;
  await new Promise(resolve => setTimeout(resolve, 600));
  const fxPayload = await fetchJson(fxUrl, fetcher) as YahooChart;
  const btc = yahooSeries(btcPayload);
  const fx = yahooSeries(fxPayload);
  const currentFx = Number(fxPayload.chart?.result?.[0]?.meta?.regularMarketPrice);
  const fallbackFx = Number.isFinite(currentFx) && currentFx > 1 ? currentFx : fx.at(-1)?.price;
  if (!fallbackFx) throw new Error("Cotação USD/BRL indisponível para derivar o histórico.");
  const points = btc.map(point => ({ timestamp: point.timestamp, priceBrl: Math.round(point.price * nearestPriorPrice(fx, point.timestamp, fallbackFx) * 100) / 100 }));
  return buildHistory({ period, points, source: "Yahoo Finance", sourceUrl: `${btcUrl} + ${fxUrl}`, now });
}

export async function getBtcBrlHistory(period: BtcHistoryPeriod, options: { fetcher?: FetchLike; now?: number; forceRefresh?: boolean } = {}) {
  const now = options.now ?? Date.now();
  const fetcher = options.fetcher ?? fetch;
  const cached = cache.get(period);
  if (!options.forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const errors: string[] = [];
  for (const source of [fetchCoinGeckoBtcBrlHistory, fetchYahooBtcBrlHistory]) {
    try {
      const data = await source(period, fetcher, now);
      cache.set(period, { data, fetchedAt: now });
      return data;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (cached && now - cached.fetchedAt <= MAX_STALE_MS) return { ...cached.data, stale: true };
  throw new Error(`Histórico BTC/BRL indisponível. ${errors.join(" ")}`);
}

export function clearBtcBrlHistoryCache() {
  cache.clear();
}
